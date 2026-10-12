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

    // Per-variant tint over the shared melty-flesh texture
    const tint = new THREE.Color(config.skinColor || 0xffffff).lerp(new THREE.Color(0xffffff), 0.45);
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
        const mat = src.clone();
        mat.color.copy(tint);
        mat.roughness = 0.62;
        mat.metalness = 0.02;
        mesh.material = mat;
      }
    });

    // Clip lookup table
    const clips: Record<string, THREE.AnimationClip> = {};
    for (const c of this.clips) clips[c.name] = c;

    const mixer = new THREE.AnimationMixer(root);
    const rig: GltfRig = {
      root,
      mixer,
      clips,
      headBone: this.findBone(root, 'head_014'),
      jawBone: this.findBone(root, 'jaw_019'),
      currentAction: null,
      currentState: '',
    };

    // ---- Invisible hitboxes parented to bones (follow animation) ----
    const hitboxMeshes: THREE.Mesh[] = [];
    const addHitbox = (
      boneName: string,
      radius: number,
      zone: 'HEAD' | 'TORSO' | 'LIMB',
      offset?: [number, number, number],
      limb?: 'ARM_L' | 'ARM_R' | 'LEG_L' | 'LEG_R'
    ) => {
      const bone = this.findBone(root, boneName);
      if (!bone) return;
      const hb = this.makeHitbox(radius, zone, zombieId);
      if (offset) hb.position.set(offset[0], offset[1], offset[2]);
      if (limb) hb.userData.limb = limb;
      bone.add(hb);
      hitboxMeshes.push(hb);
    };

    // Head & jaw
    addHitbox('head_014', 0.15 * (config.scale || 1), 'HEAD', [0, 0.1, 0.02]);
    // Torso chain
    addHitbox('hip_016', 0.21, 'TORSO');
    addHitbox('spine01_052', 0.22, 'TORSO', [0, 0.08, 0]);
    addHitbox('chest_017', 0.24, 'TORSO', [0, 0.05, 0.02]);
    // Limbs (spheres at each major joint approximate the limb volume); each
    // carries a limb tag so dismemberment severs the exact limb that was hit
    addHitbox('upper_arm_L_03', 0.11, 'LIMB', [0, -0.12, 0], 'ARM_L');
    addHitbox('forearm_L_051', 0.1, 'LIMB', [0, -0.12, 0], 'ARM_L');
    addHitbox('upper_arm_R_07', 0.11, 'LIMB', [0, -0.12, 0], 'ARM_R');
    addHitbox('forearm_R_09', 0.1, 'LIMB', [0, -0.12, 0], 'ARM_R');
    addHitbox('thigh_L_034', 0.14, 'LIMB', [0, -0.16, 0], 'LEG_L');
    addHitbox('shin_L_035', 0.12, 'LIMB', [0, -0.16, 0], 'LEG_L');
    addHitbox('thigh_R_038', 0.14, 'LIMB', [0, -0.16, 0], 'LEG_R');
    addHitbox('shin_R_039', 0.12, 'LIMB', [0, -0.16, 0], 'LEG_R');

    // ---- Glowing infected eyes (readable at night, horror silhouette) ----
    if (rig.headBone) {
      const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(config.eyeGlowColor || 0xffaa00).multiplyScalar(2.4) });
      const eyeGeo = new THREE.SphereGeometry(0.028, 6, 5);
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.07, 0.13, 0.12);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeR.position.set(0.07, 0.13, 0.12);
      rig.headBone.add(eyeL, eyeR);
    }

    // ---- Colossus pulsing weakpoint on the chest ----
    if (config.isBoss) {
      const chest = this.findBone(root, 'chest_017');
      if (chest) {
        const wpMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3b1f).multiplyScalar(2.8) });
        const wp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), wpMat);
        wp.position.set(0, 0.12, 0.24);
        wp.userData.hitZone = 'WEAKPOINT';
        wp.userData.zombieId = zombieId;
        wp.userData.isHitbox = true;
        chest.add(wp);
        hitboxMeshes.push(wp);
        rig.weakpointMesh = wp;
      }
    }

    return { rig, hitboxMeshes, headMesh: hitboxMeshes[0] };
  }

  /** Crossfade to the animation matching the zombie AI state and tick the mixer. */
  public static updateAnimation(zombie: ZombieInstance, delta: number) {
    const rig = zombie.gltfRig;
    if (!rig) return;

    if (zombie.isDead) {
      // Decapitation: collapse the head bone so the skull vanishes from the mesh
      if (zombie.isDecapitated && rig.headBone) {
        rig.headBone.scale.setScalar(0.001);
      }
      this.crossfadeTo(rig, 'death', 0.22, false, 0.9);
      rig.mixer.update(delta);
      return;
    }

    let clipName = 'idle01';
    let timeScale = 1.0;
    let loop = true;

    const isCrawler = zombie.type === 'crawler';
    const isFast = zombie.type === 'runner' || zombie.type === 'stalker' || zombie.isFrenzied;

    switch (zombie.state) {
      case 'IDLE':
        clipName = zombie.type === 'spitter' || zombie.type === 'bloater' ? 'eat' : 'idle01';
        timeScale = 0.9;
        break;
      case 'WANDER':
        clipName = 'walk01';
        timeScale = 0.75;
        break;
      case 'ALERT':
        clipName = 'caution';
        timeScale = 1.0;
        break;
      case 'STAGGER':
        clipName = 'damage';
        timeScale = 1.4;
        loop = false;
        break;
      case 'ATTACK':
        clipName = isCrawler ? 'on_all_four_eat' : 'attack01';
        timeScale = 1.25;
        break;
      case 'CHASE':
      default:
        if (isCrawler) {
          clipName = 'on_all_four_A';
          timeScale = 1.3;
        } else if (isFast) {
          clipName = 'run';
          timeScale = THREE.MathUtils.clamp(zombie.speed / 2.4, 0.85, 1.5);
        } else {
          clipName = 'walk02';
          timeScale = THREE.MathUtils.clamp(zombie.speed / 1.4, 0.8, 1.3);
        }
        break;
    }

    // Bullet-hit slowdown drags the animation down too
    if (zombie.slowTimer > 0) {
      timeScale *= Math.max(0.35, zombie.slowMultiplier);
    }

    this.crossfadeTo(rig, clipName, zombie.state === 'STAGGER' ? 0.08 : 0.2, loop, timeScale);
    rig.mixer.update(delta);

    // Pulsing boss weakpoint
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
