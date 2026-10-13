import * as THREE from 'three';
import { ZombieConfig, ZombieTypeKey, ZombieState } from '../types';
import { ProceduralTextures } from '../textures/ProceduralTextures';
import { MeltyZombieTexture, MELTY_UV } from '../textures/MeltyZombieTexture';
import { GltfZombieFactory, GltfRig } from './GltfZombieFactory';
import { ColossusModel } from './ColossusModel';
import { createVatZombie, updateVatZombie, shouldUseVat, preloadVatAnimations } from './VatZombieFactory';
import { GraphicsSettings } from '../core/GraphicsSettings';

function speedMultDefault(_type: ZombieTypeKey): number {
  return 0.88 + Math.random() * 0.24;
}

export interface ZombieInstance {
  id: string;
  type: ZombieTypeKey;
  config: ZombieConfig;
  mesh: THREE.Group;
  headMesh: THREE.Mesh;
  weakpointMesh?: THREE.Mesh;
  hitboxMeshes: THREE.Object3D[];
  hp: number;
  maxHp: number;
  state: ZombieState;
  stateTimer: number;
  attackTimer: number;
  staggerTimer: number;
  speed: number;
  targetPosition: THREE.Vector3;
  animTime: number;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  neck: THREE.Group;
  jaw: THREE.Group;
  // Realistic GLTF zombie rig (null-ish for legacy procedural zombies)
  gltfRig?: (GltfRig & { weakpointMesh?: THREE.Mesh }) | null;
  // Static-sculpt boss rig (Blind Hunter colossus) — no skeleton, procedural sway
  staticRig?: { root: THREE.Group } | null;
  // VAT (Vertex Animation Texture) for mobile LOW/MEDIUM presets
  vatData?: any | null;
  isDead: boolean;
  isDecapitated: boolean;
  isDismemberedArm: boolean;
  deathTimer: number;
  groanTimer: number;
  detectionRadius: number;
  isAlerted: boolean;
  alertReactionTimer: number;
  wanderTimer: number;
  wanderTarget: THREE.Vector3 | null;
  spawnOrigin: THREE.Vector3;
  isFromNarrowPath: boolean;
  narrowPathExit: THREE.Vector3 | null;
  hasExitedNarrowPath: boolean;
  speedMultiplier: number;
  slowTimer: number;
  slowMultiplier: number;
  strafeDir: number;
  strafeTimer: number;
  barrelMesh?: THREE.Mesh;
  bleedTimer?: number;
  // Location-specific dismemberment state: accumulated trauma per limb and
  // the record of limbs already torn off (arms end attack reach, legs cripple)
  limbDamage?: Partial<Record<'ARM_L' | 'ARM_R' | 'LEG_L' | 'LEG_R', number>>;
  severedLimbs?: Partial<Record<'ARM_L' | 'ARM_R' | 'LEG_L' | 'LEG_R', boolean>>;
  isBoss?: boolean;
  bossName?: string;
  isFrenzied?: boolean;
  frenzyTimer?: number;
  frenzyDuration?: number;
  frenzyCooldownTimer?: number;
  exhaustionTimer?: number;
  targetIsDrone?: boolean;
  hasScreamed?: boolean;
}

export class ZombieModelFactory {
  private static sharedFleshMat: THREE.MeshStandardMaterial | null = null;
  private static sharedBoneMat: THREE.MeshStandardMaterial | null = null;
  private static sharedGoreMat: THREE.MeshStandardMaterial | null = null;
  private static sharedBootMat: THREE.MeshStandardMaterial | null = null;
  private static sharedTeethMat: THREE.MeshStandardMaterial | null = null;

  private static initMaterials() {
    if (this.sharedFleshMat) return;

    const fleshTex = ProceduralTextures.getRealisticZombieSkin();
    this.sharedFleshMat = new THREE.MeshStandardMaterial({
      map: fleshTex,
      roughness: 0.65,
      metalness: 0.06,
    });

    this.sharedBoneMat = new THREE.MeshStandardMaterial({
      color: 0xe6e0d0,
      roughness: 0.45,
      metalness: 0.08,
    });

    this.sharedGoreMat = new THREE.MeshStandardMaterial({
      color: 0x4a0404,
      roughness: 0.22,
      metalness: 0.12,
    });

    this.sharedBootMat = new THREE.MeshStandardMaterial({
      color: 0x141416,
      roughness: 0.8,
      metalness: 0.2,
    });

    this.sharedTeethMat = new THREE.MeshStandardMaterial({
      color: 0xd8c89a, // decayed yellowed enamel
      roughness: 0.35,
      metalness: 0.04,
    });
  }

  private static getDetectionRadius(type: ZombieTypeKey): number {
    switch (type) {
      case 'runner':
        return 22 + (Math.random() - 0.5) * 4;
      case 'screamer':
        return 28 + (Math.random() - 0.5) * 4;
      case 'stalker':
        return 30 + (Math.random() - 0.5) * 4;
      case 'brute':
        return 19 + (Math.random() - 0.5) * 4;
      case 'enforcer':
        return 22 + (Math.random() - 0.5) * 4;
      case 'spitter':
        return 24 + (Math.random() - 0.5) * 4;
      case 'colossus':
        return 34;
      case 'crawler':
        return 15 + (Math.random() - 0.5) * 3;
      case 'walker':
      default:
        return 17 + (Math.random() - 0.5) * 4;
    }
  }

  public static createZombie(
    type: ZombieTypeKey,
    id: string,
    config: ZombieConfig,
    isFromNarrowPath: boolean = false,
    narrowPathExit: THREE.Vector3 | null = null,
    spawnPos?: THREE.Vector3
  ): ZombieInstance {
    this.initMaterials();

    // Boss colossus uses the authored Blind Hunter sculpt when streamed in
    const colossusBuilt = type === 'colossus' ? ColossusModel.createRig(id, config) : null;
    if (colossusBuilt) {
      const root = new THREE.Group();
      root.name = `zombie_${id}`;
      root.add(colossusBuilt.root);
      // Hitboxes are world-sized: parent them to the UNSCALED outer group
      for (const hb of colossusBuilt.hitboxMeshes) {
        root.add(hb);
      }
      return {
        id,
        type,
        config,
        mesh: root,
        headMesh: colossusBuilt.headMesh,
        weakpointMesh: colossusBuilt.weakpointMesh,
        hitboxMeshes: colossusBuilt.hitboxMeshes,
        hp: config.maxHp,
        maxHp: config.maxHp,
        state: isFromNarrowPath ? 'WANDER' : (Math.random() < 0.35 ? 'WANDER' : 'IDLE'),
        stateTimer: 0,
        attackTimer: 1.5,
        staggerTimer: 0,
        speed: config.speed,
        targetPosition: new THREE.Vector3(),
        animTime: Math.random() * 10,
        leftArm: new THREE.Group(),
        rightArm: new THREE.Group(),
        leftLeg: new THREE.Group(),
        rightLeg: new THREE.Group(),
        torso: new THREE.Group(),
        head: new THREE.Group(),
        neck: new THREE.Group(),
        jaw: new THREE.Group(),
        gltfRig: null,
        staticRig: { root: colossusBuilt.root },
        isDead: false,
        isDecapitated: false,
        isDismemberedArm: false,
        deathTimer: 0,
        groanTimer: Math.random() * 5 + 3,
        detectionRadius: ZombieModelFactory.getDetectionRadius(type),
        isAlerted: false,
        alertReactionTimer: 0.4 + Math.random() * 1.2,
        wanderTimer: Math.random() * 4 + 2,
        wanderTarget: null,
        spawnOrigin: spawnPos ? spawnPos.clone() : new THREE.Vector3(),
        isFromNarrowPath,
        narrowPathExit: narrowPathExit ? narrowPathExit.clone() : null,
        hasExitedNarrowPath: false,
        speedMultiplier: speedMultDefault(type),
        slowTimer: 0,
        slowMultiplier: 1.0,
        strafeDir: Math.random() < 0.5 ? -1 : 1,
        strafeTimer: Math.random() * 2 + 1,
        isBoss: config.isBoss || type === 'colossus',
        bossName: config.name,
        isFrenzied: false,
        frenzyTimer: 0,
        frenzyDuration: 3.5,
        frenzyCooldownTimer: 7.0 + Math.random() * 3.0,
        exhaustionTimer: 0,
        targetIsDrone: false,
      };
    }

    // Check if we should use VAT (Vertex Animation Texture) for mobile LOW/MEDIUM
    const useVat = shouldUseVat() && type !== 'colossus' && !config.isBoss;
    if (useVat) {
      const vatResult = createVatZombie(type, id, config);
      if (vatResult) {
        const root = new THREE.Group();
        root.name = `vat_zombie_${id}`;
        root.add(vatResult.mesh);
        // Add hitboxes to root
        for (const hb of vatResult.hitboxMeshes) {
          root.add(hb);
        }
        return {
          id,
          type,
          config,
          mesh: root,
          headMesh: vatResult.mesh,
          weakpointMesh: undefined,
          hitboxMeshes: vatResult.hitboxMeshes,
          hp: config.maxHp,
          maxHp: config.maxHp,
          state: isFromNarrowPath ? 'WANDER' : (Math.random() < 0.35 ? 'WANDER' : 'IDLE'),
          stateTimer: 0,
          attackTimer: 1.5,
          staggerTimer: 0,
          speed: config.speed,
          targetPosition: new THREE.Vector3(),
          animTime: Math.random() * 10,
          leftArm: new THREE.Group(),
          rightArm: new THREE.Group(),
          leftLeg: new THREE.Group(),
          rightLeg: new THREE.Group(),
          torso: new THREE.Group(),
          head: new THREE.Group(),
          neck: new THREE.Group(),
          jaw: new THREE.Group(),
          gltfRig: null,
          staticRig: null,
          vatData: vatResult.vatData,
          isDead: false,
          isDecapitated: false,
          isDismemberedArm: false,
          deathTimer: 0,
          groanTimer: Math.random() * 5 + 3,
          detectionRadius: ZombieModelFactory.getDetectionRadius(type),
          isAlerted: false,
          alertReactionTimer: 0.4 + Math.random() * 1.2,
          wanderTimer: Math.random() * 4 + 2,
          wanderTarget: null,
          spawnOrigin: spawnPos ? spawnPos.clone() : new THREE.Vector3(),
          isFromNarrowPath,
          narrowPathExit: narrowPathExit ? narrowPathExit.clone() : null,
          hasExitedNarrowPath: false,
          speedMultiplier: speedMultDefault(type),
          slowTimer: 0,
          slowMultiplier: 1.0,
          strafeDir: Math.random() < 0.5 ? -1 : 1,
          strafeTimer: Math.random() * 2 + 1,
          isBoss: config.isBoss || type === 'colossus',
          bossName: config.name,
          isFrenzied: false,
          frenzyTimer: 0,
          frenzyDuration: 3.5,
          frenzyCooldownTimer: 7.0 + Math.random() * 3.0,
          exhaustionTimer: 0,
          targetIsDrone: false,
        };
      }
    }

    // Prefer the realistic skinned GLTF zombie; fall back to the procedural
    // rig only while the model stream is still loading.
    const built = GltfZombieFactory.createRig(id, config);
    if (built) {
      const root = new THREE.Group();
      root.name = `zombie_${id}`;
      root.add(built.rig.root);
      return {
        id,
        type,
        config,
        mesh: root,
        headMesh: built.headMesh,
        weakpointMesh: built.rig.weakpointMesh,
        hitboxMeshes: built.hitboxMeshes,
        hp: config.maxHp,
        maxHp: config.maxHp,
        state: isFromNarrowPath ? 'WANDER' : (Math.random() < 0.35 ? 'WANDER' : 'IDLE'),
        stateTimer: 0,
        attackTimer: 1.5,
        staggerTimer: 0,
        speed: config.speed,
        targetPosition: new THREE.Vector3(),
        animTime: Math.random() * 10,
        leftArm: new THREE.Group(),
        rightArm: new THREE.Group(),
        leftLeg: new THREE.Group(),
        rightLeg: new THREE.Group(),
        torso: new THREE.Group(),
        head: new THREE.Group(),
        neck: new THREE.Group(),
        jaw: new THREE.Group(),
        gltfRig: built.rig,
        isDead: false,
        isDecapitated: false,
        isDismemberedArm: false,
        deathTimer: 0,
        groanTimer: Math.random() * 5 + 3,
        detectionRadius: ZombieModelFactory.getDetectionRadius(type),
        isAlerted: false,
        alertReactionTimer: 0.4 + Math.random() * 1.2,
        wanderTimer: Math.random() * 4 + 2,
        wanderTarget: null,
        spawnOrigin: spawnPos ? spawnPos.clone() : new THREE.Vector3(),
        isFromNarrowPath,
        narrowPathExit: narrowPathExit ? narrowPathExit.clone() : null,
        hasExitedNarrowPath: false,
        speedMultiplier: speedMultDefault(type),
        slowTimer: 0,
        slowMultiplier: 1.0,
        strafeDir: Math.random() < 0.5 ? -1 : 1,
        strafeTimer: Math.random() * 2 + 1,
        isBoss: config.isBoss || type === 'colossus',
        bossName: config.name,
        isFrenzied: false,
        frenzyTimer: 0,
        frenzyDuration: 3.5,
        frenzyCooldownTimer: 7.0 + Math.random() * 3.0,
        exhaustionTimer: 0,
        targetIsDrone: false,
      };
    }

    const root = new THREE.Group();
    root.name = `zombie_${id}`;

    const scale = config.scale || 1.0;
    const hitboxMeshes: THREE.Object3D[] = [];

    // Authentic Melty Zombie PBR Materials using the exact diffuse pattern texture
    const meltySkinMat = MeltyZombieTexture.getMaterial(0.62, 0.05);
    const meltyGoreMat = MeltyZombieTexture.getGoreMaterial();

    // Secondary archetype cloth/armor material if needed for mutated variants
    let clothTexture: THREE.CanvasTexture;
    if (type === 'brute' || type === 'colossus') {
      clothTexture = ProceduralTextures.getTacticalArmorPlate();
    } else if (type === 'runner') {
      clothTexture = ProceduralTextures.getCamoFabric();
    } else {
      clothTexture = ProceduralTextures.getDecayedFabric();
    }

    const clothMat = new THREE.MeshStandardMaterial({
      color: config.clothColor,
      map: clothTexture,
      roughness: 0.85,
      metalness: 0.08,
    });

    // ==========================================
    // 1. PELVIS & ANATOMICAL TORSO ROOT
    // ==========================================
    const torsoGroup = new THREE.Group();
    torsoGroup.position.y = 0.96 * scale;

    // Pelvis & Lower Waist (Humanoid military trousers waistband & belt)
    const camoTex = ProceduralTextures.getCamoFabric();
    const camoPantsMat = new THREE.MeshStandardMaterial({
      map: camoTex,
      roughness: 0.85,
      metalness: 0.05,
    });
    const darkBootMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.7,
      metalness: 0.35,
    });
    const buckleMat = new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      metalness: 0.85,
      roughness: 0.25,
    });

    const pelvisGeo = new THREE.CapsuleGeometry(0.19 * scale, 0.16 * scale, 8, 14);
    const pelvisMesh = new THREE.Mesh(pelvisGeo, camoPantsMat);
    pelvisMesh.position.y = -0.12 * scale;
    pelvisMesh.castShadow = true;
    torsoGroup.add(pelvisMesh);

    // Tactical Military Utility Belt with silver buckle (matching image)
    const beltGeo = new THREE.CylinderGeometry(0.2 * scale, 0.2 * scale, 0.06 * scale, 12);
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });
    const belt = new THREE.Mesh(beltGeo, beltMat);
    belt.position.y = -0.05 * scale;
    torsoGroup.add(belt);

    const buckleGeo = new THREE.BoxGeometry(0.06 * scale, 0.05 * scale, 0.02 * scale);
    const buckle = new THREE.Mesh(buckleGeo, buckleMat);
    buckle.position.set(0, -0.05 * scale, 0.2 * scale);
    torsoGroup.add(buckle);

    // Abdomen / Midsection (Sunken belly with dense cluster of dark red circular pustules as shown in image.png)
    const abGeo = new THREE.CapsuleGeometry(0.17 * scale, 0.22 * scale, 8, 14);
    MeltyZombieTexture.remapGeometryUV(abGeo, MELTY_UV.BELLY_PUSTULES);
    const abMesh = new THREE.Mesh(abGeo, meltySkinMat);
    abMesh.position.y = 0.09 * scale;
    abMesh.castShadow = true;
    torsoGroup.add(abMesh);

    // Thoracic Ribcage (Emaciated, broad chest displaying horizontal striated ribs & pectorals matching image.png)
    const chestGeo = new THREE.CapsuleGeometry(0.24 * scale, 0.30 * scale, 12, 16);
    chestGeo.scale(1.08, 1.0, 0.88);
    MeltyZombieTexture.remapGeometryUV(chestGeo, MELTY_UV.CHEST_RIBS);
    const chestMesh = new THREE.Mesh(chestGeo, meltySkinMat);
    chestMesh.position.y = 0.40 * scale;
    chestMesh.castShadow = true;
    chestMesh.userData = { zombieId: id, hitZone: 'TORSO' };
    hitboxMeshes.push(chestMesh);
    torsoGroup.add(chestMesh);

    // Anatomical Clavicles (Collarbone ridges across top of chest)
    [-0.12, 0.12].forEach((cx) => {
      const clavicleGeo = new THREE.CylinderGeometry(0.016 * scale, 0.014 * scale, 0.18 * scale, 6);
      clavicleGeo.rotateZ(cx < 0 ? 0.35 : -0.35);
      MeltyZombieTexture.remapGeometryUV(clavicleGeo, MELTY_UV.NECK_THROAT);
      const clavicle = new THREE.Mesh(clavicleGeo, meltySkinMat);
      clavicle.position.set(cx * scale, 0.53 * scale, 0.12 * scale);
      torsoGroup.add(clavicle);
    });

    // Anatomical Spine Column vertebrae along back
    const spineGroup = new THREE.Group();
    spineGroup.position.set(0, 0.32 * scale, -0.15 * scale);
    for (let v = -4; v <= 4; v++) {
      const vertGeo = new THREE.BoxGeometry(0.04 * scale, 0.028 * scale, 0.038 * scale);
      MeltyZombieTexture.remapGeometryUV(vertGeo, MELTY_UV.CHEST_RIBS);
      const vert = new THREE.Mesh(vertGeo, this.sharedBoneMat!);
      vert.position.y = v * 0.048 * scale;
      spineGroup.add(vert);
    }
    torsoGroup.add(spineGroup);

    // ==========================================
    // 2. NECK & HIGH-DETAIL SCULPTED SKULL
    // ==========================================
    const neckGroup = new THREE.Group();
    neckGroup.position.set(0, 0.62 * scale, 0.02 * scale);

    const neckGeo = new THREE.CapsuleGeometry(0.08 * scale, 0.16 * scale, 8, 12);
    MeltyZombieTexture.remapGeometryUV(neckGeo, MELTY_UV.NECK_THROAT);
    const neckMesh = new THREE.Mesh(neckGeo, meltySkinMat);
    neckMesh.position.y = 0.08 * scale;
    neckMesh.castShadow = true;
    neckGroup.add(neckMesh);

    // Throat sternocleidomastoid tendons
    [-0.045, 0.045].forEach((tx) => {
      const tendonGeo = new THREE.CylinderGeometry(0.012 * scale, 0.015 * scale, 0.16 * scale, 6);
      MeltyZombieTexture.remapGeometryUV(tendonGeo, MELTY_UV.NECK_THROAT);
      const tendon = new THREE.Mesh(tendonGeo, meltyGoreMat);
      tendon.position.set(tx * scale, 0.08 * scale, 0.06 * scale);
      tendon.rotation.z = tx < 0 ? -0.15 : 0.15;
      neckGroup.add(tendon);
    });

    // Head container (can be severed on fatal headshot decapitation!)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.22 * scale, 0.02 * scale);

    // Anatomically sculpted Cranium / Skull matching image.png
    const craniumGeo = new THREE.SphereGeometry(0.175 * scale, 16, 14);
    craniumGeo.scale(0.85, 1.14, 1.02);
    MeltyZombieTexture.remapGeometryUV(craniumGeo, MELTY_UV.HEAD_FACE);
    const headMesh = new THREE.Mesh(craniumGeo, meltySkinMat);
    headMesh.castShadow = true;
    headMesh.userData = { zombieId: id, hitZone: 'HEAD' };
    hitboxMeshes.push(headMesh);
    headGroup.add(headMesh);

    // Brow Ridge & Forehead
    const browGeo = new THREE.BoxGeometry(0.22 * scale, 0.04 * scale, 0.09 * scale);
    MeltyZombieTexture.remapGeometryUV(browGeo, MELTY_UV.HEAD_FACE);
    const brow = new THREE.Mesh(browGeo, meltySkinMat);
    brow.position.set(0, 0.06 * scale, 0.14 * scale);
    headGroup.add(brow);

    // Exposed Cheekbones (Zygomatic Arches)
    [-0.10, 0.10].forEach((cx) => {
      const cheekGeo = new THREE.BoxGeometry(0.05 * scale, 0.038 * scale, 0.06 * scale);
      MeltyZombieTexture.remapGeometryUV(cheekGeo, MELTY_UV.HEAD_FACE);
      const cheek = new THREE.Mesh(cheekGeo, meltySkinMat);
      cheek.position.set(cx * scale, -0.01 * scale, 0.13 * scale);
      headGroup.add(cheek);
    });

    // Deep Dark Sunken Orbital Eye Cavities (Pitch dark voids as shown in image.png)
    const socketGeo = new THREE.SphereGeometry(0.048 * scale, 10, 10);
    const socketMat = new THREE.MeshBasicMaterial({ color: 0x0a0303 });
    const leftSocket = new THREE.Mesh(socketGeo, socketMat);
    leftSocket.position.set(-0.068 * scale, 0.035 * scale, 0.145 * scale);
    const rightSocket = new THREE.Mesh(socketGeo, socketMat);
    rightSocket.position.set(0.068 * scale, 0.035 * scale, 0.145 * scale);
    headGroup.add(leftSocket, rightSocket);

    // Sickly Diseased Amber-Yellow Eyes matching bottom-center texture and image.png
    const eyeGeo = new THREE.SphereGeometry(0.032 * scale, 10, 10);
    MeltyZombieTexture.remapGeometryUV(eyeGeo, MELTY_UV.EYEBALL);
    const eyeMat = MeltyZombieTexture.getEyeMaterial(config.eyeGlowColor || 0xf59e0b);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.068 * scale, 0.035 * scale, 0.165 * scale);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.068 * scale, 0.035 * scale, 0.165 * scale);
    headGroup.add(leftEye, rightEye);

    // Sunken Triangular Nasal Cavity (Exposed dark nasal septum void)
    const noseGeo = new THREE.ConeGeometry(0.026 * scale, 0.06 * scale, 3);
    noseGeo.rotateX(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeo, meltyGoreMat);
    nose.position.set(0, -0.02 * scale, 0.165 * scale);
    headGroup.add(nose);

    // Rotting Jaw with Articulated Snarling Mandible
    const jawGroup = new THREE.Group();
    jawGroup.position.set(0, -0.075 * scale, 0.04 * scale);

    const jawGeo = new THREE.BoxGeometry(0.16 * scale, 0.07 * scale, 0.16 * scale);
    MeltyZombieTexture.remapGeometryUV(jawGeo, MELTY_UV.HEAD_FACE);
    const jawMesh = new THREE.Mesh(jawGeo, meltySkinMat);
    jawMesh.position.set(0, -0.035 * scale, 0.06 * scale);
    jawGroup.add(jawMesh);

    // Upper Dental Arch (Decayed yellowed teeth matching texture enamel)
    const toothGeo = new THREE.ConeGeometry(0.012 * scale, 0.035 * scale, 4);
    toothGeo.rotateX(Math.PI);
    MeltyZombieTexture.remapGeometryUV(toothGeo, MELTY_UV.TEETH_ENAMEL);
    for (let t = -4; t <= 4; t++) {
      if (t === 0) continue;
      const angle = (t / 4) * (Math.PI * 0.32);
      const tx = Math.sin(angle) * 0.078 * scale;
      const tz = Math.cos(angle) * 0.078 * scale + 0.09 * scale;
      const tooth = new THREE.Mesh(toothGeo, this.sharedTeethMat!);
      tooth.position.set(tx, -0.058 * scale, tz);
      if (Math.abs(t) === 2) tooth.scale.set(1.3, 1.4, 1.3);
      headGroup.add(tooth);
    }

    // Lower Dental Arch (Matching lower decayed teeth)
    const lowerToothGeo = new THREE.ConeGeometry(0.011 * scale, 0.032 * scale, 4);
    MeltyZombieTexture.remapGeometryUV(lowerToothGeo, MELTY_UV.TEETH_ENAMEL);
    for (let t = -4; t <= 4; t++) {
      if (t === 0) continue;
      const angle = (t / 4) * (Math.PI * 0.32);
      const tx = Math.sin(angle) * 0.074 * scale;
      const tz = Math.cos(angle) * 0.074 * scale + 0.05 * scale;
      const tooth = new THREE.Mesh(lowerToothGeo, this.sharedTeethMat!);
      tooth.position.set(tx, 0.012 * scale, tz);
      if (Math.abs(t) === 2) tooth.scale.set(1.25, 1.35, 1.25);
      jawGroup.add(tooth);
    }

    // Bloody Tongue & Dark Oral Cavity
    const tongueGeo = new THREE.CapsuleGeometry(0.022 * scale, 0.06 * scale, 4, 8);
    tongueGeo.rotateX(Math.PI / 2.5);
    const tongue = new THREE.Mesh(tongueGeo, meltyGoreMat);
    tongue.position.set(0, -0.01 * scale, 0.07 * scale);
    jawGroup.add(tongue);

    // Cheek Flaps revealing teeth from side
    [-0.085, 0.085].forEach((cx) => {
      const cheekFlapGeo = new THREE.BoxGeometry(0.014 * scale, 0.055 * scale, 0.07 * scale);
      const cheekFlap = new THREE.Mesh(cheekFlapGeo, meltyGoreMat);
      cheekFlap.position.set(cx * scale, -0.045 * scale, 0.11 * scale);
      headGroup.add(cheekFlap);
    });

    headGroup.add(jawGroup);
    neckGroup.add(headGroup);
    torsoGroup.add(neckGroup);

    // ==========================================
    // 3. ARTICULATED ANATOMICAL ARMS & TALONS
    // ==========================================
    const createArm = (isLeft: boolean): THREE.Group => {
      const armGroup = new THREE.Group();
      const side = isLeft ? -1 : 1;
      armGroup.position.set(side * 0.32 * scale, 0.50 * scale, 0);

      // Rounded Shoulder Deltoid
      const shoulderGeo = new THREE.SphereGeometry(0.105 * scale, 8, 8);
      MeltyZombieTexture.remapGeometryUV(shoulderGeo, MELTY_UV.LIMB_ARM);
      const shoulder = new THREE.Mesh(shoulderGeo, meltySkinMat);
      armGroup.add(shoulder);

      // Upper Arm (Muscular Bicep / Tricep Capsule with red necrotic lesions)
      const bicepGeo = new THREE.CapsuleGeometry(0.072 * scale, 0.28 * scale, 8, 12);
      bicepGeo.translate(0, -0.17 * scale, 0);
      MeltyZombieTexture.remapGeometryUV(bicepGeo, MELTY_UV.LIMB_ARM);
      const bicep = new THREE.Mesh(bicepGeo, meltySkinMat);
      bicep.castShadow = true;
      bicep.userData = { zombieId: id, hitZone: 'LIMB', limb: isLeft ? 'ARM_L' : 'ARM_R' };
      hitboxMeshes.push(bicep);
      armGroup.add(bicep);

      // Elbow joint with subtle bone protrusion
      const elbowGeo = new THREE.SphereGeometry(0.055 * scale, 6, 6);
      MeltyZombieTexture.remapGeometryUV(elbowGeo, MELTY_UV.LIMB_ARM);
      const elbow = new THREE.Mesh(elbowGeo, this.sharedBoneMat!);
      elbow.position.set(0, -0.34 * scale, -0.02 * scale);
      armGroup.add(elbow);

      // Forearm Group (Articulated at elbow)
      const foreArmGroup = new THREE.Group();
      foreArmGroup.position.set(0, -0.34 * scale, 0);

      // Anatomical Forearm Capsule
      const foreArmGeo = new THREE.CapsuleGeometry(0.062 * scale, 0.30 * scale, 8, 12);
      foreArmGeo.translate(0, -0.17 * scale, 0);
      MeltyZombieTexture.remapGeometryUV(foreArmGeo, MELTY_UV.LIMB_ARM);
      const foreArm = new THREE.Mesh(foreArmGeo, meltySkinMat);
      foreArm.castShadow = true;
      foreArm.userData = { zombieId: id, hitZone: 'LIMB', limb: isLeft ? 'ARM_L' : 'ARM_R' };
      hitboxMeshes.push(foreArm);
      foreArmGroup.add(foreArm);

      // Diseased Palm
      const handGeo = new THREE.BoxGeometry(0.085 * scale, 0.095 * scale, 0.038 * scale);
      handGeo.translate(0, -0.36 * scale, 0.015 * scale);
      MeltyZombieTexture.remapGeometryUV(handGeo, MELTY_UV.HAND_CLAW);
      const hand = new THREE.Mesh(handGeo, meltySkinMat);
      foreArmGroup.add(hand);

      // 5 Elongated Curved Claw Fingers (Talons) matching bottom-right texture & image.png
      for (let f = 0; f < 5; f++) {
        const fingerGroup = new THREE.Group();
        const fAngle = (f - 2) * 0.16; // Splayed outward
        fingerGroup.position.set((f - 2) * 0.018 * scale, -0.41 * scale, 0.02 * scale);
        fingerGroup.rotation.z = fAngle;
        fingerGroup.rotation.x = 0.28; // Curved forward claw posture

        // Finger bone segment
        const segmentGeo = new THREE.CapsuleGeometry(0.008 * scale, 0.06 * scale, 4, 6);
        MeltyZombieTexture.remapGeometryUV(segmentGeo, MELTY_UV.HAND_CLAW);
        const segment = new THREE.Mesh(segmentGeo, meltySkinMat);
        segment.position.y = -0.03 * scale;
        fingerGroup.add(segment);

        // Curved sharp talon claw tip
        const talonGeo = new THREE.ConeGeometry(0.009 * scale, 0.075 * scale, 4);
        talonGeo.rotateX(0.4);
        MeltyZombieTexture.remapGeometryUV(talonGeo, MELTY_UV.HAND_CLAW);
        const talon = new THREE.Mesh(talonGeo, this.sharedTeethMat!);
        talon.position.set(0, -0.085 * scale, 0.015 * scale);
        fingerGroup.add(talon);

        foreArmGroup.add(fingerGroup);
      }

      armGroup.add(foreArmGroup);
      return armGroup;
    };

    const leftArmGroup = createArm(true);
    const rightArmGroup = createArm(false);
    torsoGroup.add(leftArmGroup, rightArmGroup);

    // ==========================================
    // 4. ARTICULATED HUMAN LEGS IN CAMO BDU PANTS & COMBAT BOOTS
    // ==========================================
    const createLeg = (isLeft: boolean): THREE.Group => {
      const legGroup = new THREE.Group();
      const side = isLeft ? -1 : 1;
      legGroup.position.set(side * 0.15 * scale, 0, 0);

      // Anatomical Upper Thigh in Camouflage BDU Combat Trousers (as shown in image)
      const thighGeo = new THREE.CapsuleGeometry(0.11 * scale, 0.34 * scale, 8, 14);
      thighGeo.translate(0, -0.22 * scale, 0);
      const thigh = new THREE.Mesh(thighGeo, camoPantsMat);
      thigh.castShadow = true;
      thigh.userData = { zombieId: id, hitZone: 'LIMB', limb: isLeft ? 'LEG_L' : 'LEG_R' };
      hitboxMeshes.push(thigh);
      legGroup.add(thigh);

      // Tactical Side Cargo Flap Pocket (matching military BDU in image)
      const cargoGeo = new THREE.BoxGeometry(0.06 * scale, 0.14 * scale, 0.12 * scale);
      const cargoPocket = new THREE.Mesh(cargoGeo, camoPantsMat);
      cargoPocket.position.set(side * 0.11 * scale, -0.22 * scale, 0.02 * scale);
      legGroup.add(cargoPocket);

      // Knee Joint with reinforced fabric pad
      const kneeGeo = new THREE.SphereGeometry(0.076 * scale, 8, 8);
      const knee = new THREE.Mesh(kneeGeo, camoPantsMat);
      knee.position.set(0, -0.43 * scale, 0.02 * scale);
      legGroup.add(knee);

      // Anatomical Lower Calf in High-Cut Tactical Combat Assault Boot
      const shinGeo = new THREE.CapsuleGeometry(0.088 * scale, 0.36 * scale, 8, 14);
      shinGeo.translate(0, -0.65 * scale, 0);
      const shin = new THREE.Mesh(shinGeo, darkBootMat);
      shin.castShadow = true;
      shin.userData = { zombieId: id, hitZone: 'LIMB', limb: isLeft ? 'LEG_L' : 'LEG_R' };
      hitboxMeshes.push(shin);
      legGroup.add(shin);

      // HEAVY LACED MILITARY COMBAT BOOT (matching attached image)
      const footGroup = new THREE.Group();
      footGroup.position.set(0, -0.86 * scale, 0);

      // Boot Ankle Collar
      const ankleGeo = new THREE.CylinderGeometry(0.075 * scale, 0.08 * scale, 0.14 * scale, 8);
      const ankle = new THREE.Mesh(ankleGeo, darkBootMat);
      ankle.position.y = 0.04 * scale;
      footGroup.add(ankle);

      // Boot Heel & Sole (Thick lugged rubber combat sole)
      const soleGeo = new THREE.BoxGeometry(0.13 * scale, 0.04 * scale, 0.28 * scale);
      soleGeo.translate(0, -0.06 * scale, 0.06 * scale);
      const sole = new THREE.Mesh(soleGeo, darkBootMat);
      sole.castShadow = true;
      footGroup.add(sole);

      // Boot Upper & Steel Toe Cap
      const bootVampGeo = new THREE.BoxGeometry(0.12 * scale, 0.08 * scale, 0.24 * scale);
      bootVampGeo.translate(0, -0.02 * scale, 0.08 * scale);
      const bootVamp = new THREE.Mesh(bootVampGeo, darkBootMat);
      footGroup.add(bootVamp);

      // Silver Boot Buckles / Eyelets (matching attached soldier image)
      [-0.04, 0.04].forEach((bx) => {
        const claspGeo = new THREE.BoxGeometry(0.025 * scale, 0.02 * scale, 0.04 * scale);
        const clasp = new THREE.Mesh(claspGeo, buckleMat);
        clasp.position.set(bx * scale, 0.02 * scale, 0.12 * scale);
        footGroup.add(clasp);
      });

      legGroup.add(footGroup);
      return legGroup;
    };

    const leftLegGroup = createLeg(true);
    const rightLegGroup = createLeg(false);

    root.add(torsoGroup, leftLegGroup, rightLegGroup);

    // ==========================================
    // 5. ARCHETYPE MUTATIONS & ACCESSORIES
    // ==========================================
    let weakpointMesh: THREE.Mesh | undefined;
    let barrelMesh: THREE.Mesh | undefined;

    if (type === 'brute' || type === 'spitter') {
      // Bloated Demolition Butcher / Volatile Mutant (Matching User Image: Explosive Fuel Drum Strapped Across Torso!)
      const drumGeo = new THREE.CylinderGeometry(0.24 * scale, 0.24 * scale, 0.62 * scale, 12);
      drumGeo.rotateZ(Math.PI / 4.2); // Angled diagonally across chest
      const drumMat = new THREE.MeshStandardMaterial({
        map: ProceduralTextures.getHazardStripes(),
        roughness: 0.45,
        metalness: 0.7,
      });
      barrelMesh = new THREE.Mesh(drumGeo, drumMat);
      barrelMesh.position.set(0.03 * scale, 0.38 * scale, 0.26 * scale);
      barrelMesh.castShadow = true;
      barrelMesh.userData = { zombieId: id, hitZone: 'BARREL' };
      hitboxMeshes.push(barrelMesh);
      torsoGroup.add(barrelMesh);

      // Heavy Leather Harness Belts crossing torso and securing the volatile drum
      [-0.14, 0.14].forEach((sx) => {
        const strapGeo = new THREE.BoxGeometry(0.68 * scale, 0.045 * scale, 0.35 * scale);
        strapGeo.rotateZ(sx < 0 ? 0.38 : -0.38);
        const strapMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.85 });
        const strap = new THREE.Mesh(strapGeo, strapMat);
        strap.position.set(0, 0.38 * scale, 0.18 * scale);
        torsoGroup.add(strap);
      });

      // Stitched necrotic flesh & embedded glowing yellow mutant eyes on torso flesh (as shown in image)
      const mutEyes = [
        [-0.18, 0.18, 0.2],
        [0.22, 0.52, 0.16],
        [-0.12, 0.56, 0.19],
      ];
      mutEyes.forEach(([ex, ey, ez]) => {
        const mEyeGeo = new THREE.SphereGeometry(0.042 * scale, 8, 8);
        const mEyeMat = MeltyZombieTexture.getEyeMaterial(0xf59e0b);
        const mEye = new THREE.Mesh(mEyeGeo, mEyeMat);
        mEye.position.set(ex * scale, ey * scale, ez * scale);
        torsoGroup.add(mEye);
      });
    }

    if (type === 'brute') {
      // Heavily armored mutated brute: Ceramic Tactical Plate Carrier, Riot Helmet, Knee/Elbow Guards, Mutated Shoulder Boulders
      const plateCarrierGeo = new THREE.BoxGeometry(0.56 * scale, 0.44 * scale, 0.16 * scale);
      const armorMat = new THREE.MeshStandardMaterial({
        map: ProceduralTextures.getTacticalArmorPlate(),
        roughness: 0.5,
        metalness: 0.4,
      });
      const plateCarrier = new THREE.Mesh(plateCarrierGeo, armorMat);
      plateCarrier.position.set(0, 0.42 * scale, 0.18 * scale);
      torsoGroup.add(plateCarrier);

      // Tactical Magazine pouches on chest
      for (let m = -1; m <= 1; m++) {
        const pouchGeo = new THREE.BoxGeometry(0.1 * scale, 0.16 * scale, 0.06 * scale);
        const pouch = new THREE.Mesh(pouchGeo, clothMat);
        pouch.position.set(m * 0.14 * scale, 0.38 * scale, 0.27 * scale);
        torsoGroup.add(pouch);
      }

      // Ballistic Riot Helmet with broken visor
      const helmetGeo = new THREE.SphereGeometry(0.23 * scale, 14, 12);
      helmetGeo.scale(1.0, 0.92, 1.05);
      const helmet = new THREE.Mesh(helmetGeo, armorMat);
      helmet.position.set(0, 0.04 * scale, 0);
      headGroup.add(helmet);

      // Broken visor revealing glowing eyes
      const visorGeo = new THREE.CylinderGeometry(0.21 * scale, 0.21 * scale, 0.08 * scale, 10, 1, true, -Math.PI * 0.25, Math.PI * 0.5);
      const visorMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.55,
        roughness: 0.1,
      });
      const visor = new THREE.Mesh(visorGeo, visorMat);
      visor.position.set(0, 0.02 * scale, 0.08 * scale);
      headGroup.add(visor);

      // Spiked shoulder boulders
      [-0.48, 0.48].forEach((sx) => {
        const boulderGeo = new THREE.DodecahedronGeometry(0.28 * scale);
        const boulder = new THREE.Mesh(boulderGeo, meltySkinMat);
        boulder.position.set(sx * scale, 0.6 * scale, 0);
        torsoGroup.add(boulder);

        const spikeGeo = new THREE.ConeGeometry(0.11 * scale, 0.5 * scale, 5);
        spikeGeo.rotateZ(sx < 0 ? Math.PI / 4 : -Math.PI / 4);
        const spike = new THREE.Mesh(spikeGeo, this.sharedBoneMat!);
        spike.position.set(sx * 1.35 * scale, 0.78 * scale, 0);
        torsoGroup.add(spike);
      });
    } else if (type === 'crawler') {
      // Gut crawler: Visceral abdominal drag coils, shredded legs, low crawling posture
      for (let g = 0; g < 4; g++) {
        const gutGeo = new THREE.TorusGeometry(0.12 * scale, 0.04 * scale, 6, 10);
        const gut = new THREE.Mesh(gutGeo, this.sharedGoreMat!);
        gut.position.set((g - 1.5) * 0.08 * scale, -0.22 * scale, (g % 2 === 0 ? 0.08 : -0.06) * scale);
        torsoGroup.add(gut);
      }
      torsoGroup.position.y = 0.45 * scale;
      torsoGroup.rotation.x = 0.85;
    } else if (type === 'runner') {
      // Feral Stalker: Hunched spine, protruding dorsal bone spikes, elongated vicious claws
      for (let s = 0; s < 5; s++) {
        const spikeGeo = new THREE.ConeGeometry(0.03 * scale, 0.18 * scale, 4);
        spikeGeo.rotateX(-Math.PI / 3);
        const spike = new THREE.Mesh(spikeGeo, this.sharedBoneMat!);
        spike.position.set(0, (0.2 + s * 0.09) * scale, -0.18 * scale);
        torsoGroup.add(spike);
      }
    } else if (type === 'spitter') {
      // Toxic Acid Bloater: Swollen glowing acid belly & pulsating shoulder pustules
      const bileMat = new THREE.MeshStandardMaterial({
        color: 0x84cc16,
        emissive: 0x65a30d,
        emissiveIntensity: 0.85,
        roughness: 0.2,
      });

      // Swollen acid belly
      const bellyGeo = new THREE.SphereGeometry(0.24 * scale, 10, 10);
      bellyGeo.scale(1.1, 0.9, 1.25);
      const belly = new THREE.Mesh(bellyGeo, bileMat);
      belly.position.set(0, 0.12 * scale, 0.18 * scale);
      torsoGroup.add(belly);

      // 5 Pulsating acid pustules on back and shoulders
      const pustulePositions = [
        [-0.22, 0.56, -0.14],
        [0.22, 0.5, -0.15],
        [-0.15, 0.38, -0.18],
        [0.18, 0.64, 0.12],
        [-0.12, 0.62, 0.14],
      ];
      pustulePositions.forEach(([px, py, pz]) => {
        const pustuleGeo = new THREE.SphereGeometry(0.12 * scale, 8, 8);
        const pustule = new THREE.Mesh(pustuleGeo, bileMat);
        pustule.position.set(px * scale, py * scale, pz * scale);
        torsoGroup.add(pustule);
      });
    } else if (type === 'colossus') {
      // Massive Colossus Boss: Bolted titanium plates & exposed cardiac thermal core!
      const coreGeo = new THREE.SphereGeometry(0.24 * scale, 14, 14);
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 1.4,
        roughness: 0.15,
      });
      weakpointMesh = new THREE.Mesh(coreGeo, coreMat);
      weakpointMesh.position.set(0, 0.42 * scale, 0.22 * scale);
      weakpointMesh.userData = { zombieId: id, hitZone: 'WEAKPOINT' };
      hitboxMeshes.push(weakpointMesh);
      torsoGroup.add(weakpointMesh);

      // Bolted steel rebar cage around weakpoint
      const cageGeo = new THREE.TorusGeometry(0.32 * scale, 0.045 * scale, 6, 14);
      const cageMat = new THREE.MeshStandardMaterial({
        map: ProceduralTextures.getRustedMetal(),
        metalness: 0.85,
        roughness: 0.35,
      });
      const cage = new THREE.Mesh(cageGeo, cageMat);
      cage.position.set(0, 0.42 * scale, 0.23 * scale);
      torsoGroup.add(cage);
    } else if (type === 'screamer') {
      // Screamer / Banshee: Elongated necrotic spines & pulsating violet bio-resonance
      const spineSpikes = [-0.18, 0.18];
      spineSpikes.forEach((sx) => {
        const spikeGeo = new THREE.ConeGeometry(0.04 * scale, 0.45 * scale, 4);
        spikeGeo.rotateX(-Math.PI / 4);
        const spikeMat = new THREE.MeshStandardMaterial({ color: 0x4a044e, roughness: 0.3 });
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        spike.position.set(sx * scale, 0.65 * scale, -0.15 * scale);
        torsoGroup.add(spike);
      });
      // Vocal resonance throat nodule
      const noduleGeo = new THREE.SphereGeometry(0.09 * scale, 8, 8);
      const noduleMat = new THREE.MeshBasicMaterial({ color: 0xd946ef });
      const nodule = new THREE.Mesh(noduleGeo, noduleMat);
      nodule.position.set(0, 0.68 * scale, 0.14 * scale);
      torsoGroup.add(nodule);
    } else if (type === 'bloater') {
      // Massive radioactive swollen belly with glowing pustules
      const bloatMat = new THREE.MeshStandardMaterial({
        color: 0x4d7c0f,
        roughness: 0.25,
        metalness: 0.1,
      });
      const bigBellyGeo = new THREE.SphereGeometry(0.38 * scale, 12, 12);
      bigBellyGeo.scale(1.2, 1.1, 1.35);
      const bigBelly = new THREE.Mesh(bigBellyGeo, bloatMat);
      bigBelly.position.set(0, 0.18 * scale, 0.26 * scale);
      bigBelly.userData = { zombieId: id, hitZone: 'TORSO' };
      hitboxMeshes.push(bigBelly);
      torsoGroup.add(bigBelly);

      // Explosive pustules on back and belly
      const boils = [
        [-0.24, 0.52, 0.28],
        [0.22, 0.48, 0.3],
        [-0.15, 0.12, 0.46],
        [0.18, 0.16, 0.44],
        [0.0, 0.62, -0.22],
      ];
      boils.forEach(([bx, by, bz]) => {
        const boilGeo = new THREE.SphereGeometry(0.13 * scale, 8, 8);
        const boilMat = new THREE.MeshBasicMaterial({ color: 0xa3e635 });
        const boil = new THREE.Mesh(boilGeo, boilMat);
        boil.position.set(bx * scale, by * scale, bz * scale);
        torsoGroup.add(boil);
      });
    } else if (type === 'stalker') {
      // Shadow Stalker: Razor forearm carbon blades & stealth chassis
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.9, roughness: 0.1 });
      [-0.45, 0.45].forEach((bx) => {
        const bladeGeo = new THREE.BoxGeometry(0.04 * scale, 0.38 * scale, 0.12 * scale);
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.set(bx * scale, 0.22 * scale, 0.15 * scale);
        torsoGroup.add(blade);
      });
      // Stealth dorsal ridge
      const ridgeGeo = new THREE.BoxGeometry(0.06 * scale, 0.5 * scale, 0.15 * scale);
      const ridgeMat = new THREE.MeshBasicMaterial({ color: 0x0891b2 });
      const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
      ridge.position.set(0, 0.35 * scale, -0.2 * scale);
      torsoGroup.add(ridge);
    } else if (type === 'enforcer') {
      // Tactical Riot Enforcer: Heavy Kevlar Chestplate, Riot Visor, Pauldrons
      const armorMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.7,
        roughness: 0.3,
        map: ProceduralTextures.getTacticalArmorPlate(),
      });
      const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.62 * scale, 0.52 * scale, 0.22 * scale), armorMat);
      chestPlate.position.set(0, 0.35 * scale, 0.14 * scale);
      torsoGroup.add(chestPlate);

      // Riot Helmet on Head
      const helmetGeo = new THREE.SphereGeometry(0.22 * scale, 12, 10);
      helmetGeo.scale(1.0, 0.9, 1.08);
      const helmet = new THREE.Mesh(helmetGeo, armorMat);
      helmet.position.set(0, 0.08 * scale, 0.02 * scale);
      headGroup.add(helmet);

      // Riot Face Shield Visor
      const visorGeo = new THREE.BoxGeometry(0.26 * scale, 0.12 * scale, 0.04 * scale);
      const visorMat = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.75,
        roughness: 0.1,
        metalness: 0.5,
      });
      const visor = new THREE.Mesh(visorGeo, visorMat);
      visor.position.set(0, 0.03 * scale, 0.22 * scale);
      headGroup.add(visor);
    }

    const speedMult = 0.88 + Math.random() * 0.24;
    let detectionRadius = 18;
    switch (type) {
      case 'runner':
        detectionRadius = 22 + (Math.random() - 0.5) * 4;
        break;
      case 'stalker':
        detectionRadius = 28 + (Math.random() - 0.5) * 4;
        break;
      case 'screamer':
        detectionRadius = 30 + (Math.random() - 0.5) * 4;
        break;
      case 'bloater':
        detectionRadius = 20 + (Math.random() - 0.5) * 4;
        break;
      case 'enforcer':
        detectionRadius = 22 + (Math.random() - 0.5) * 4;
        break;
      case 'spitter':
        detectionRadius = 24 + (Math.random() - 0.5) * 4;
        break;
      case 'brute':
        detectionRadius = 19 + (Math.random() - 0.5) * 4;
        break;
      case 'crawler':
        detectionRadius = 15 + (Math.random() - 0.5) * 3;
        break;
      case 'colossus':
        detectionRadius = 34;
        break;
      case 'walker':
      default:
        detectionRadius = 17 + (Math.random() - 0.5) * 4;
        break;
    }

    return {
      id,
      type,
      config,
      mesh: root,
      headMesh,
      weakpointMesh,
      hitboxMeshes,
      hp: config.maxHp,
      maxHp: config.maxHp,
      state: isFromNarrowPath ? 'WANDER' : (Math.random() < 0.35 ? 'WANDER' : 'IDLE'),
      stateTimer: 0,
      attackTimer: 1.5,
      staggerTimer: 0,
      speed: config.speed,
      targetPosition: new THREE.Vector3(),
      animTime: Math.random() * 10,
      leftArm: leftArmGroup,
      rightArm: rightArmGroup,
      leftLeg: leftLegGroup,
      rightLeg: rightLegGroup,
      torso: torsoGroup,
      head: headGroup,
      neck: neckGroup,
      jaw: jawGroup,
      isDead: false,
      isDecapitated: false,
      isDismemberedArm: false,
      deathTimer: 0,
      groanTimer: Math.random() * 5 + 3,
      detectionRadius,
      isAlerted: false,
      alertReactionTimer: 0.4 + Math.random() * 1.2,
      wanderTimer: Math.random() * 4 + 2,
      wanderTarget: null,
      spawnOrigin: spawnPos ? spawnPos.clone() : new THREE.Vector3(),
      isFromNarrowPath,
      narrowPathExit: narrowPathExit ? narrowPathExit.clone() : null,
      hasExitedNarrowPath: false,
      speedMultiplier: speedMult,
      slowTimer: 0,
      slowMultiplier: 1.0,
      strafeDir: Math.random() < 0.5 ? -1 : 1,
      strafeTimer: Math.random() * 2 + 1,
      barrelMesh,
      isBoss: config.isBoss || type === 'colossus',
      bossName: config.name,
      isFrenzied: false,
      frenzyTimer: 0,
      frenzyDuration: 3.5,
      frenzyCooldownTimer: 7.0 + Math.random() * 3.0,
      exhaustionTimer: 0,
      targetIsDrone: false,
    };
  }

  public static updateZombieAnimation(zombie: ZombieInstance, delta: number, distanceToPlayer: number) {
    // VAT (Vertex Animation Texture) for mobile LOW/MEDIUM
    if (zombie.vatData) {
      updateVatZombie(zombie, delta, distanceToPlayer);
      return;
    }

    // Static boss sculpt: procedural shamble sway, no skeleton
    if (zombie.staticRig) {
      this.updateStaticBossAnimation(zombie, delta);
      return;
    }

    // Realistic GLTF rig: state-driven animation clips via its AnimationMixer
    if (zombie.gltfRig) {
      if (zombie.isDead) {
        zombie.deathTimer += delta;
        GltfZombieFactory.updateAnimation(zombie, delta);
        return;
      }
      if (zombie.slowTimer > 0) {
        zombie.slowTimer -= delta;
        if (zombie.slowTimer <= 0) {
          zombie.slowMultiplier = 1.0;
        }
      }
      GltfZombieFactory.updateAnimation(zombie, delta);
      return;
    }

    if (zombie.isDead) {
      zombie.deathTimer += delta;

      // Realistic crumple / ragdoll collapse physics
      if (zombie.deathTimer < 1.0) {
        // Drop down and pitch back/sideways
        zombie.mesh.position.y = Math.max(0.04, zombie.mesh.position.y - delta * 3.4);
        zombie.mesh.rotation.x = THREE.MathUtils.lerp(zombie.mesh.rotation.x, -Math.PI / 2.1, delta * 9);
        zombie.torso.rotation.z = THREE.MathUtils.lerp(zombie.torso.rotation.z, 0.38, delta * 8);
        zombie.leftArm.rotation.x = THREE.MathUtils.lerp(zombie.leftArm.rotation.x, 0.7, delta * 8);
        zombie.rightArm.rotation.x = THREE.MathUtils.lerp(zombie.rightArm.rotation.x, 0.95, delta * 8);
      }
      return;
    }

    // Handle bullet-impact slowdown timer
    if (zombie.slowTimer > 0) {
      zombie.slowTimer -= delta;
      if (zombie.slowTimer <= 0) {
        zombie.slowMultiplier = 1.0;
      }
    }

    const currentAnimSpeed = zombie.speed * 2.5 * (zombie.slowTimer > 0 ? zombie.slowMultiplier : 1.0);
    zombie.animTime += delta * currentAnimSpeed;
    let t = zombie.animTime;

    if (zombie.state === 'STAGGER') {
      // Violent impact stagger flinch
      zombie.torso.rotation.x = THREE.MathUtils.lerp(zombie.torso.rotation.x, -0.48, delta * 18);
      zombie.head.rotation.x = THREE.MathUtils.lerp(zombie.head.rotation.x, -0.35, delta * 18);
      zombie.leftArm.rotation.x = THREE.MathUtils.lerp(zombie.leftArm.rotation.x, -0.95, delta * 18);
      zombie.rightArm.rotation.x = THREE.MathUtils.lerp(zombie.rightArm.rotation.x, -0.95, delta * 18);
      return;
    }

    if (zombie.state === 'ATTACK') {
      zombie.animTime += delta * 6;
      t = zombie.animTime;
      // Aggressive claw slash & biting maw animation
      const swipe = Math.sin(t * 5);
      zombie.leftArm.rotation.x = -1.35 + swipe * 1.0;
      zombie.rightArm.rotation.x = -1.35 - swipe * 1.0;
      zombie.torso.rotation.x = 0.32 + Math.abs(swipe) * 0.16;
      zombie.torso.rotation.y = Math.sin(t * 3) * 0.28;

      // Snarl & chomp jaw aggressively
      zombie.jaw.rotation.x = 0.28 + Math.sin(t * 9) * 0.28;
      return;
    }

    // SPECIALIZED CRAWLER DRAG ANIMATION
    if (zombie.type === 'crawler') {
      zombie.animTime += delta * (zombie.speed * 2.5);
      t = zombie.animTime;
      const crawlCycle = Math.sin(t * 1.5);
      zombie.mesh.position.y = 0.22;
      zombie.torso.rotation.x = 0.75;
      zombie.torso.rotation.y = crawlCycle * 0.2;
      zombie.leftArm.rotation.x = -1.7 + crawlCycle * 0.55;
      zombie.rightArm.rotation.x = -1.7 - crawlCycle * 0.55;
      zombie.leftLeg.rotation.x = 0.9 + Math.sin(t * 0.5) * 0.15;
      zombie.rightLeg.rotation.x = 0.95 - Math.sin(t * 0.5) * 0.15;
      zombie.head.rotation.x = -0.45; // crane head upward to stare at player
      zombie.jaw.rotation.x = 0.18 + Math.sin(t * 3) * 0.18;
      return;
    }

    // IDLE ANIMATION: Unalerted, breathing, scanning subtly
    if (zombie.state === 'IDLE') {
      zombie.animTime += delta * 1.3;
      t = zombie.animTime;
      // Stationary legs
      zombie.leftLeg.rotation.x = THREE.MathUtils.lerp(zombie.leftLeg.rotation.x, 0, delta * 6);
      zombie.rightLeg.rotation.x = THREE.MathUtils.lerp(zombie.rightLeg.rotation.x, 0, delta * 6);
      // Low slack arms
      if (!zombie.isDismemberedArm) {
        zombie.leftArm.rotation.x = THREE.MathUtils.lerp(zombie.leftArm.rotation.x, -0.32 + Math.sin(t * 0.8) * 0.08, delta * 4);
        zombie.rightArm.rotation.x = THREE.MathUtils.lerp(zombie.rightArm.rotation.x, -0.32 + Math.cos(t * 0.8) * 0.08, delta * 4);
        zombie.leftArm.rotation.z = THREE.MathUtils.lerp(zombie.leftArm.rotation.z, -0.16, delta * 4);
        zombie.rightArm.rotation.z = THREE.MathUtils.lerp(zombie.rightArm.rotation.z, 0.16, delta * 4);
      }
      // Gentle breathing torso
      zombie.torso.rotation.x = THREE.MathUtils.lerp(zombie.torso.rotation.x, 0.12 + Math.sin(t * 1.1) * 0.04, delta * 4);
      zombie.torso.rotation.y = THREE.MathUtils.lerp(zombie.torso.rotation.y, Math.sin(t * 0.4) * 0.1, delta * 3);
      // Head subtly looking around for sounds
      zombie.head.rotation.y = THREE.MathUtils.lerp(zombie.head.rotation.y, Math.sin(t * 0.5) * 0.32, delta * 3);
      zombie.jaw.rotation.x = 0.06 + Math.sin(t * 1.4) * 0.05;
      return;
    }

    // ALERT ANIMATION: Sudden awareness, snapping to attention, snarling
    if (zombie.state === 'ALERT') {
      zombie.animTime += delta * 2.2;
      t = zombie.animTime;
      zombie.leftLeg.rotation.x = THREE.MathUtils.lerp(zombie.leftLeg.rotation.x, 0, delta * 8);
      zombie.rightLeg.rotation.x = THREE.MathUtils.lerp(zombie.rightLeg.rotation.x, 0, delta * 8);
      if (!zombie.isDismemberedArm) {
        zombie.leftArm.rotation.x = THREE.MathUtils.lerp(zombie.leftArm.rotation.x, -0.92 + Math.sin(t * 2.5) * 0.1, delta * 8);
        zombie.rightArm.rotation.x = THREE.MathUtils.lerp(zombie.rightArm.rotation.x, -0.92 + Math.cos(t * 2.5) * 0.1, delta * 8);
      }
      zombie.torso.rotation.x = THREE.MathUtils.lerp(zombie.torso.rotation.x, 0.26, delta * 8);
      zombie.jaw.rotation.x = THREE.MathUtils.lerp(zombie.jaw.rotation.x, 0.28 + Math.sin(t * 3.5) * 0.1, delta * 8);
      return;
    }

    // NATURAL WANDERING / CHASE SPRINTING LOCOMOTION
    const isWander = zombie.state === 'WANDER';
    const speedMult = isWander ? 0.38 : 1.0;
    zombie.animTime += delta * (zombie.speed * zombie.speedMultiplier * 2.5 * speedMult);
    t = zombie.animTime;

    const isRunner = zombie.type === 'runner';
    const strideScale = (isRunner ? 1.15 : 0.78) * (isWander ? 0.65 : 1.0);
    const stride = Math.sin(t) * strideScale;

    // Natural hip swing & leg movement
    zombie.leftLeg.rotation.x = stride;
    zombie.rightLeg.rotation.x = -stride;

    // Organic asymmetrical arm swaying & reaching
    if (!zombie.isDismemberedArm) {
      const armReach = isWander ? -0.65 : -1.25;
      zombie.leftArm.rotation.x = armReach + Math.sin(t + 0.4) * (isWander ? 0.2 : 0.35);
      zombie.rightArm.rotation.x = armReach + Math.cos(t) * (isWander ? 0.2 : 0.35);
      zombie.leftArm.rotation.z = -0.22 + Math.sin(t * 0.5) * 0.15;
      zombie.rightArm.rotation.z = 0.22 - Math.sin(t * 0.5) * 0.15;
    }

    // Torso breathing & predatory hunch
    zombie.torso.rotation.x = (isRunner ? 0.42 : isWander ? 0.18 : 0.24) + Math.abs(Math.sin(t)) * 0.08;
    zombie.torso.rotation.y = Math.sin(t) * (isWander ? 0.1 : 0.18);
    zombie.torso.rotation.z = Math.sin(t * 0.5) * 0.06;

    // Head tracking twitch & jaw snarl
    zombie.head.rotation.y = Math.sin(t * 0.9) * (isWander ? 0.14 : 0.22);
    zombie.head.rotation.z = Math.sin(t * 0.6) * 0.12;
    zombie.jaw.rotation.x = (isWander ? 0.08 : 0.14) + Math.sin(t * 2.2) * 0.14;

      // Pulsating weakpoint on Colossus
      if (zombie.weakpointMesh) {
        const pulse = 1.0 + Math.sin(t * 7) * 0.22;
        zombie.weakpointMesh.scale.set(pulse, pulse, pulse);
      }
  }

  /** Static boss sculpt: shamble sway while alive, slow topple on death. */
  private static updateStaticBossAnimation(zombie: ZombieInstance, delta: number) {
    const root = zombie.staticRig!.root;

    if (zombie.isDead) {
      zombie.deathTimer += delta;
      if (zombie.deathTimer < 1.8) {
        // Heavy collapse: pitch forward and settle into the ground
        root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, -Math.PI / 2.15, delta * 3.4);
        root.position.y = Math.max(-0.12, root.position.y - delta * 0.55);
      }
      if (zombie.weakpointMesh) {
        zombie.weakpointMesh.visible = false;
      }
      return;
    }

    const t = (zombie.animTime += delta);

    // Shamble: lumbering sway, forward hunch when charging, ground-thumping bob
    const charging = zombie.state === 'CHASE' || zombie.state === 'ATTACK';
    root.rotation.z = Math.sin(t * 1.4) * 0.05;
    root.rotation.x = charging ? 0.12 + Math.sin(t * 2.6) * 0.03 : Math.sin(t * 0.8) * 0.02;
    root.position.y = Math.abs(Math.sin(t * 2.2)) * 0.07;

    // Stagger flinch: sharp recoil
    if (zombie.state === 'STAGGER') {
      root.rotation.x = -0.22;
    }

    // Pulsing weakpoint beacon
    if (zombie.weakpointMesh) {
      const pulse = 1.0 + Math.sin(t * 6) * 0.25;
      zombie.weakpointMesh.scale.setScalar(pulse);
    }
  }

  /**
   * Swap a procedural-fallback zombie over to the skinned GLTF rig once the
   * model has finished loading — mirrors AllySoldier's procedural-upgrade
   * path. The world transform, AI state and hitbox array are preserved; only
   * the visual rig and hitbox meshes are replaced. Returns false when the
   * zombie already has a skinned/sculpted rig or the model isn't ready.
   */
  public static upgradeZombieToGltf(zombie: ZombieInstance): boolean {
    if (zombie.gltfRig || zombie.staticRig || zombie.vatData || zombie.isDead) return false;
    const built = GltfZombieFactory.createRig(zombie.id, zombie.config);
    if (!built) return false;

    const root = zombie.mesh;
    for (const child of [...root.children]) root.remove(child);
    root.add(built.rig.root);
    for (const hb of built.hitboxMeshes) root.add(hb);

    zombie.hitboxMeshes.length = 0;
    zombie.hitboxMeshes.push(...built.hitboxMeshes);
    zombie.gltfRig = built.rig;
    zombie.headMesh = built.headMesh;
    zombie.weakpointMesh = built.rig.weakpointMesh;
    zombie.vatData = null; // Clear VAT data
    return true;
  }

  /** Fatal headshot: remove the head from the rig (procedural hide / bone collapse). */
  public static applyDecapitation(zombie: ZombieInstance) {
    if (zombie.vatData) {
      zombie.vatData.material.uniforms.uDecapitated.value = 1;
      zombie.isDecapitated = true;
      return;
    }
    if (zombie.gltfRig) {
      if (zombie.gltfRig.headBone) {
        zombie.gltfRig.headBone.scale.setScalar(0.001);
      }
    } else {
      zombie.head.visible = false;
    }
  }

  /** Limb-shot dismemberment: hide one arm on either rig type. */
  public static applyDismemberArm(zombie: ZombieInstance) {
    this.applyDismemberLimb(zombie, Math.random() < 0.5 ? 'ARM_L' : 'ARM_R');
  }

  /**
   * Location-specific dismemberment: sever the exact limb the bullet struck,
   * on both GLTF rigs (bone-chain collapse) and procedural zombies (group
   * hide). Returns false when the limb was already gone so callers can skip
   * the duplicate gore burst.
   */
  public static applyDismemberLimb(
    zombie: ZombieInstance,
    limb: 'ARM_L' | 'ARM_R' | 'LEG_L' | 'LEG_R'
  ): boolean {
    if (zombie.vatData) {
      const limbs = zombie.vatData.material.uniforms.uSeveredLimbs.value;
      if (limb === 'ARM_L') limbs.x = 1;
      else if (limb === 'ARM_R') limbs.y = 1;
      else if (limb === 'LEG_L') limbs.z = 1;
      else if (limb === 'LEG_R') limbs.w = 1;
      return true;
    }
    if (zombie.gltfRig) {
      return GltfZombieFactory.collapseLimb(zombie.gltfRig, limb);
    }
    if (zombie.staticRig) return false; // sculpted boss has no removable limbs
    const group =
      limb === 'ARM_L' ? zombie.leftArm
      : limb === 'ARM_R' ? zombie.rightArm
      : limb === 'LEG_L' ? zombie.leftLeg
      : zombie.rightLeg;
    if (!group || !group.visible) return false;
    group.visible = false;
    return true;
  }
}
