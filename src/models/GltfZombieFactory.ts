import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ZombieConfig } from '../types';
import type { ZombieInstance } from './ZombieModel';

/**
 * Realistic skinned zombie ("Zombie De Goma" by julianmurcia245, CC-BY-4.0).
 * The GLTF is preloaded once, then every zombie instance is a SkeletonUtils
 * clone with its own AnimationMixer. Invisible hitbox capsules are parented
 * to the bones so headshot/torso/limb zones follow the animation.
 *
 * Credit (required by license):
 * "Zombie De Goma" (https://sketchfab.com/3d-models/zombie-de-goma-d0da88595c6b47129170937d1e442733)
 * by julianmurcia245 (https://sketchfab.com/julianmurcia245), CC-BY-4.0.
 */

const MODEL_URL = '/assets/models/zombie/scene.gltf';
const TARGET_HEIGHT = 1.82; // meters at config.scale === 1.0

export interface GltfRig {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  clips: Record<string, THREE.AnimationClip>;
  headBone: THREE.Object3D | null;
  jawBone: THREE.Object3D | null;
  currentAction: THREE.AnimationAction | null;
  currentState: string;
  weakpointMesh?: THREE.Mesh;
}

export class GltfZombieFactory {
  private static template: THREE.Group | null = null;
  private static clips: THREE.AnimationClip[] = [];
  private static baseScale: number = 0.2;
  public static ready = false;
  private static loading = false;
  private static loadPromise: Promise<void> | null = null;
  // Shared per-variant zombie materials (key: source material uuid + tint hex)
  private static tintMaterialCache = new Map<string, THREE.MeshStandardMaterial>();

  /** Public accessor for VAT baking */
  public static getTemplate(): THREE.Group | null {
    return this.template;
  }

  /** Public accessor for VAT baking */
  public static getClips(): THREE.AnimationClip[] {
    return this.clips;
  }

  public static preload(): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.loadPromise) return this.loadPromise;
    this.loading = true;

    const attempt = (retriesLeft: number): Promise<void> =>
      new Promise<void>((resolve) => {
        const loader = new GLTFLoader();
        loader.load(
          MODEL_URL,
          (gltf) => {
            const scene = gltf.scene;
            scene.updateMatrixWorld(true);
            const bbox = new THREE.Box3().setFromObject(scene);
            const height = Math.max(0.01, bbox.max.y - bbox.min.y);
            this.baseScale = TARGET_HEIGHT / height;
            this.template = scene;
            this.clips = gltf.animations || [];
            this.ready = true;
            this.loading = false;
            console.info(
              '%cO²%c Zombie roster loaded: "Zombie De Goma" by julianmurcia245 (CC-BY-4.0) — ' +
                this.clips.length +
                ' animations',
              'background:#b91c1c;color:#fff;padding:1px 6px;border-radius:3px;font-weight:bold',
              'color:#aaa'
            );
            resolve();
          },
          undefined,
          (err) => {
            // A transient failure (offline start, dead dev server, PWA cache
            // miss) must not kill the custom model for the whole session —
            // retry with backoff before accepting the procedural fallback.
            if (retriesLeft > 0) {
              console.warn(
                `GLTF zombie model load failed, retrying (${retriesLeft} attempts left)...`,
                err
              );
              setTimeout(() => attempt(retriesLeft - 1).then(resolve), 1500 * (4 - retriesLeft));
            } else {
              console.warn('GLTF zombie model failed to load after retries, using procedural zombies.', err);
              this.loading = false;
              resolve();
            }
          }
        );
      });

    this.loadPromise = attempt(4);
    return this.loadPromise;
  }

  private static getClip(name: string): THREE.AnimationClip | undefined {
    return this.clips.find((c) => c.name === name);
  }

  /** Find a bone whose name starts with the given prefix (e.g. 'head_014'). */
  private static findBone(root: THREE.Object3D, prefix: string): THREE.Object3D | null {
    let found: THREE.Object3D | null = null;
    root.traverse((o) => {
      if (found) return;
      if (o.name === prefix || o.name.startsWith(prefix)) {
        found = o;
      }
    });
    return found;
  }

  private static makeHitbox(radius: number, zone: 'HEAD' | 'TORSO' | 'LIMB', zombieId: string): THREE.Mesh {
    const geo = zone === 'HEAD'
      ? new THREE.SphereGeometry(radius, 8, 6)
      : new THREE.SphereGeometry(radius, 6, 5);
    // Material-level invisibility: never rendered, but raycasts still hit it
    const mat = new THREE.MeshBasicMaterial({ visible: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.hitZone = zone;
    mesh.userData.zombieId = zombieId;
    mesh.userData.isHitbox = true;
    return mesh;
  }

  /**
   * Build a clone rig for one zombie. Returns null while the GLTF is still
   * loading (caller falls back to the procedural zombie).
   * 
   * Note: The new model (zombie_bind_hunter.glb) is a static model without
   * skeleton/animations. Hitboxes are created based on the model's geometry
   * using approximate positions relative to the model's bounding box.
   */
  public static createRig(zombieId: string, config: ZombieConfig): {
    rig: GltfRig;
    hitboxMeshes: THREE.Mesh[];
    headMesh: THREE.Mesh;
  } | null {
    if (!this.template || !this.ready) return null;

    const root = skeletonClone(this.template) as THREE.Group;
    root.name = `gltf_zombie_${zombieId}`;
    root.scale.setScalar(this.baseScale * (config.scale || 1.0));

    // Per-variant tint over the shared melty-flesh texture. Cloned materials
    // are cached per (source material + tint) so every zombie of the same
    // variant shares material instances — cloning per zombie multiplies
    // shader-program state switches and defeats draw batching on mobile GPUs.
    const tintHex = new THREE.Color(config.skinColor || 0xffffff)
      .lerp(new THREE.Color(0xffffff), 0.45)
      .getHex();
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      // NO shadow casting on actors: every skinned zombie in the moonlight
      // shadow pass re-renders the whole skeleton EVERY frame — the single
      // biggest GPU cost in the game. Walls/props already ground the scene.
      mesh.castShadow = false;
      mesh.frustumCulled = false; // skinned verts move beyond the bind-pose bounds
      const src = mesh.material as THREE.MeshStandardMaterial;
      if (src) {
        const key = `${src.uuid}_${tintHex}`;
        let mat = this.tintMaterialCache.get(key);
        if (!mat) {
          mat = src.clone();
          mat.color.setHex(tintHex);
          mat.roughness = 0.62;
          mat.metalness = 0.02;
          this.tintMaterialCache.set(key, mat);
        }
        mesh.material = mat;
      }
    });

    // Compute model bounds for hitbox placement
    const bbox = new THREE.Box3().setFromObject(root);
    const height = bbox.max.y - bbox.min.y;
    const width = bbox.max.x - bbox.min.x;
    const depth = bbox.max.z - bbox.min.z;
    const centerY = (bbox.max.y + bbox.min.y) / 2;
    const centerX = (bbox.max.x + bbox.min.x) / 2;
    const centerZ = (bbox.max.z + bbox.min.z) / 2;

    // No skeleton/animations - use static model with procedural hitboxes
    const clips: Record<string, THREE.AnimationClip> = {};
    const mixer = new THREE.AnimationMixer(root); // dummy mixer for compatibility
    
    const rig: GltfRig = {
      root,
      mixer,
      clips: {},
      headBone: null,
      jawBone: null,
      currentAction: null,
      currentState: '',
    };

    // ---- Invisible hitboxes positioned relative to model bounds ----
    const hitboxMeshes: THREE.Mesh[] = [];
    const addHitbox = (
      zone: 'HEAD' | 'TORSO' | 'LIMB',
      radius: number,
      offset: [number, number, number],
      limb?: 'ARM_L' | 'ARM_R' | 'LEG_L' | 'LEG_R'
    ) => {
      const hb = this.makeHitbox(radius, zone, zombieId);
      hb.position.set(
        centerX + offset[0],
        centerY + offset[1],
        centerZ + offset[2]
      );
      if (limb) hb.userData.limb = limb;
      root.add(hb);
      hitboxMeshes.push(hb);
    };

    const scale = config.scale || 1.0;
    const h = height * (config.scale || 1.0);
    const w = width * (config.scale || 1.0);
    const d = depth * (config.scale || 1.0);
    
    const headHeight = centerY + h * 0.45;
    const torsoHeight = centerY + h * 0.1;
    const hipHeight = centerY - h * 0.2;
    const shoulderHeight = centerY + h * 0.3;
    const shoulderW = w * 0.35;
    const hipW = w * 0.25;
    const limbRadius = Math.max(w, d) * 0.08;

    // Head hitbox (approximate head position)
    addHitbox('HEAD', h * 0.15, [0, h * 0.45, d * 0.3]);

    // Torso hitboxes
    addHitbox('TORSO', h * 0.25, [0, h * 0.2, 0]);           // Chest
    addHitbox('TORSO', h * 0.2, [0, -h * 0.1, 0]);           // Lower torso
    addHitbox('TORSO', h * 0.18, [0, -h * 0.35, 0]);         // Hip/pelvis

    // Arm hitboxes (approximate positions)
    const armRadius = limbRadius;
    const shoulderY = centerY + h * 0.3;
    const armZ = d * 0.2;
    addHitbox('LIMB', armRadius, [-shoulderW, shoulderY, armZ], 'ARM_L');  // Left upper arm
    addHitbox('LIMB', armRadius * 0.8, [-shoulderW, shoulderY - h*0.25, armZ], 'ARM_L'); // Left forearm
    addHitbox('LIMB', armRadius, [shoulderW, shoulderY, armZ], 'ARM_R');   // Right upper arm
    addHitbox('LIMB', armRadius * 0.8, [shoulderW, shoulderY - h*0.25, armZ], 'ARM_R'); // Right forearm

    // Leg hitboxes
    const legRadius = limbRadius * 1.2;
    const hipY = centerY - h * 0.2;
    const legZ = d * 0.15;
    addHitbox('LIMB', legRadius, [-hipW, hipY, legZ], 'LEG_L');  // Left thigh
    addHitbox('LIMB', legRadius * 0.8, [-hipW, hipY - h*0.3, legZ], 'LEG_L'); // Left shin
    addHitbox('LIMB', legRadius, [hipW, hipY, legZ], 'LEG_R');   // Right thigh
    addHitbox('LIMB', legRadius * 0.8, [hipW, hipY - h*0.3, legZ], 'LEG_R'); // Right shin

    // ---- Glowing infected eyes (readable at night, horror silhouette) ----
    const eyeMat = new THREE.MeshBasicMaterial({ 
      color: new THREE.Color(config.eyeGlowColor || 0xffaa00).multiplyScalar(2.4) 
    });
    const eyeGeo = new THREE.SphereGeometry(0.028, 6, 5);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.07, centerY + h * 0.4, d * 0.3);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.07, centerY + h * 0.4, d * 0.3);
    root.add(eyeL, eyeR);

    // ---- Colossus pulsing weakpoint on the chest ----
    let weakpointMesh: THREE.Mesh | undefined;
    if (config.isBoss) {
      const wpMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3b1f).multiplyScalar(2.8) });
      const wp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), wpMat);
      wp.position.set(0, centerY + h * 0.2, d * 0.3);
      wp.userData.hitZone = 'WEAKPOINT';
      wp.userData.zombieId = zombieId;
      wp.userData.isHitbox = true;
      root.add(wp);
      hitboxMeshes.push(wp);
    }

    return { rig, hitboxMeshes, headMesh: hitboxMeshes[0] };
  }

  /** Update animation for static model (procedural animation only) */
  public static updateAnimation(zombie: ZombieInstance, delta: number) {
    const rig = zombie.gltfRig;
    if (!rig) return;

    if (zombie.isDead) {
      // For static model, just hide the head on death
      rig.root.traverse((obj) => {
        if (obj.name && obj.name.toLowerCase().includes('head')) {
          obj.scale.setScalar(0.001);
        }
      });
      return;
    }

    // Procedural idle animation for static model - subtle breathing/swaying
    const time = performance.now() * 0.001;
    const idleAmplitude = 0.02;
    const idleSpeed = 1.5;
    
    if (rig.root) {
      // Subtle body sway
      rig.root.rotation.y = Math.sin(rig.root.rotation.y + delta * idleSpeed) * idleAmplitude;
      rig.root.position.y = Math.sin(performance.now() * 0.001 * 1.2) * 0.01;
      
      // Subtle head bob
      rig.root.traverse((obj) => {
        if (obj.name && obj.name.toLowerCase().includes('head')) {
          obj.rotation.y = Math.sin(performance.now() * 0.001 * 2) * 0.05;
          obj.position.y = Math.sin(performance.now() * 0.001 * 2.5) * 0.01;
        }
      });
    }

    // Pulsing boss weakpoint (if exists)
    if (rig.weakpointMesh) {
      const pulse = 1.0 + Math.sin(performance.now() * 0.006) * 0.22;
      rig.weakpointMesh.scale.setScalar(pulse);
    }
  }

  private static crossfadeTo(
    rig: GltfRig,
    clipName: string,
    fade: number,
    loop: boolean,
    timeScale: number
  ) {
    if (rig.currentState === clipName && rig.currentAction) {
      rig.currentAction.timeScale = timeScale;
      return;
    }
    const clip = rig.clips[clipName] || rig.clips['idle01'];
    if (!clip) return;

    const next = rig.mixer.clipAction(clip);
    next.reset();
    next.timeScale = timeScale;
    if (!loop) {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity);
    }
    next.enabled = true;
    if (rig.currentAction && rig.currentAction !== next) {
      rig.currentAction.crossFadeTo(next, fade, false);
    }
    next.play();
    rig.currentAction = next;
    rig.currentState = clipName;
  }

  /** Hide a severed limb on the skinned mesh (bone collapse). */
  public static collapseArm(rig: GltfRig, side: 'L' | 'R') {
    this.collapseLimb(rig, side === 'L' ? 'ARM_L' : 'ARM_R');
  }

  /**
   * Collapse a specific limb bone chain to near-zero scale (the whole child
   * chain inherits it, so the limb visually vanishes). Returns false when the
   * limb was already severed — callers use that to avoid double gore bursts.
   */
  public static collapseLimb(rig: GltfRig, limb: 'ARM_L' | 'ARM_R' | 'LEG_L' | 'LEG_R'): boolean {
    const boneName =
      limb === 'ARM_L' ? 'upper_arm_L_03'
      : limb === 'ARM_R' ? 'upper_arm_R_07'
      : limb === 'LEG_L' ? 'thigh_L_034'
      : 'thigh_R_038';
    const bone = this.findBone(rig.root, boneName);
    if (!bone) return false;
    if (bone.scale.x < 0.01) return false; // already gone
    bone.scale.setScalar(0.001);
    return true;
  }
}
