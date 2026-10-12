import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * Squad ally character rig ("Winter Soldier" GLB supplied as a local asset).
 * The GLB is preloaded once, then every squad member is a SkeletonUtils clone
 * sharing the skinned template. The clip carries no baked animations, so
 * locomotion is driven procedurally:
 *
 *  - A speed-synced gait generator plants each foot on the ground during its
 *    stance phase and sweeps it backwards at EXACTLY the body's speed, so
 *    feet never slide. Swing height and stride length scale with speed.
 *  - Analytic 2-bone IK (thigh + calf) solves the planted foot position,
 *    giving real knee bend, and the foot pitch is compensated to stay level.
 *  - The pelvis bobs with the stride and the model is grounded at load time,
 *    so the soles rest exactly on the floor (no hovering).
 *
 * Falls back to the procedural box soldier while the model is loading.
 */

const MODEL_URL = '/assets/models/ally/winter_soldier.glb';
const TARGET_HEIGHT = 1.85; // meters — matches the old box-soldier silhouette

interface LegMetrics {
  hipY: number;   // hip joint height (rig-root space, rest pose)
  hipZ: number;   // hip joint forward offset
  ankleX: number; // rest ankle position (rig-root space)
  ankleY: number;
  ankleZ: number;
  thigh: number;  // thigh bone length
  calf: number;   // calf bone length
  strideCap: number; // max physically-reachable stride (leg reach envelope)
}

interface GaitState {
  phase: number;   // gait cycle phase, radians
  weight: number;  // 0 = idle stance, 1 = full stride
  speedSm: number; // smoothed movement speed (m/s)
  lastRaw: number; // last raw speed passed in (debug)
}

export interface AllyRig {
  root: THREE.Group;
  scale: number;
  // Bone references (Unreal-style naming from the GLB)
  spine: THREE.Object3D | null;
  head: THREE.Object3D | null;
  upperArmL: THREE.Object3D | null;
  lowerArmL: THREE.Object3D | null;
  handL: THREE.Object3D | null;
  weaponSocketL: THREE.Object3D | null;
  upperArmR: THREE.Object3D | null;
  lowerArmR: THREE.Object3D | null;
  handR: THREE.Object3D | null;
  thighL: THREE.Object3D | null;
  calfL: THREE.Object3D | null;
  footL: THREE.Object3D | null;
  thighR: THREE.Object3D | null;
  calfR: THREE.Object3D | null;
  footR: THREE.Object3D | null;
  // Rest pose of every animated bone — re-composed each frame
  restPose: Map<THREE.Object3D, THREE.Quaternion>;
  // Measured skeleton + grounding
  legL: LegMetrics;
  legR: LegMetrics;
  groundX: number;
  groundY: number;
  groundZ: number;
  // Gait controller state
  gait: GaitState;
}

export class AllyModelFactory {
  private static template: THREE.Group | null = null;
  private static baseScale: number = 0.01;
  public static ready = false;
  private static loadPromise: Promise<void> | null = null;

  public static preload(): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise<void>((resolve) => {
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
          this.ready = true;
          console.info(
            '%cO²%c Squad character rig loaded — IK gait driver active',
            'background:#0e7490;color:#fff;padding:1px 6px;border-radius:3px;font-weight:bold',
            'color:#aaa'
          );
          resolve();
        },
        undefined,
        (err) => {
          console.warn('Ally character model failed to load, using procedural soldiers.', err);
          resolve();
        }
      );
    });
    return this.loadPromise;
  }

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

  /**
   * Build one squad member's skinned rig. Returns null while the GLTF is
   * still loading (caller falls back to the procedural soldier).
   */
  public static createRig(allyId: string): AllyRig | null {
    if (!this.template || !this.ready) return null;

    const root = skeletonClone(this.template) as THREE.Group;
    root.name = `ally_rig_${allyId}`;
    root.scale.setScalar(this.baseScale);

    const rig: AllyRig = {
      root,
      scale: this.baseScale,
      spine: this.findBone(root, 'spine_02_'),
      head: this.findBone(root, 'head_0146'),
      upperArmL: this.findBone(root, 'upperarm_l_'),
      lowerArmL: this.findBone(root, 'lowerarm_l_'),
      handL: this.findBone(root, 'hand_l_'),
      weaponSocketL: this.findBone(root, 'weapon_l_'),
      upperArmR: this.findBone(root, 'upperarm_r_'),
      lowerArmR: this.findBone(root, 'lowerarm_r_'),
      handR: this.findBone(root, 'hand_r_'),
      thighL: this.findBone(root, 'thigh_l_'),
      calfL: this.findBone(root, 'calf_l_'),
      footL: this.findBone(root, 'foot_l_'),
      thighR: this.findBone(root, 'thigh_r_'),
      calfR: this.findBone(root, 'calf_r_'),
      footR: this.findBone(root, 'foot_r_'),
      restPose: new Map(),
      legL: { hipY: 0, hipZ: 0, ankleX: 0, ankleY: 0, ankleZ: 0, thigh: 0.45, calf: 0.45, strideCap: 0.9 },
      legR: { hipY: 0, hipZ: 0, ankleX: 0, ankleY: 0, ankleZ: 0, thigh: 0.45, calf: 0.45, strideCap: 0.9 },
      groundX: 0,
      groundY: 0,
      groundZ: 0,
      gait: { phase: Math.random() * Math.PI * 2, weight: 0, speedSm: 0, lastRaw: 0 },
    };

    // Capture the bind pose of every bone we will procedurally pose, so each
    // frame can be composed as rest * offset without accumulating drift.
    const animated = [
      rig.spine, rig.upperArmL, rig.lowerArmL, rig.upperArmR, rig.lowerArmR,
      rig.thighL, rig.calfL, rig.footL, rig.thighR, rig.calfR, rig.footR,
    ];
    for (const bone of animated) {
      if (bone) {
        rig.restPose.set(bone, bone.quaternion.clone());
      }
    }

    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      // 596-bone skinned rig: shadow-pass re-render is brutally expensive —
      // allies read fine without cast shadows under moonlight.
      mesh.castShadow = false;
      mesh.frustumCulled = false; // skinned verts move beyond the bind-pose bounds
    });

    // Measure the leg skeleton in rig-root space so the IK solver knows the
    // segment lengths, hip heights and rest ankle positions.
    root.updateMatrixWorld(true);
    const local = (bone: THREE.Object3D | null): THREE.Vector3 | null => {
      if (!bone) return null;
      const v = new THREE.Vector3();
      bone.getWorldPosition(v);
      return root.worldToLocal(v);
    };
    const measureLeg = (
      thigh: THREE.Object3D | null, calf: THREE.Object3D | null, foot: THREE.Object3D | null
    ): LegMetrics => {
      const t = local(thigh), c = local(calf), f = local(foot);
      if (!t || !c || !f) {
        return { hipY: 0, hipZ: 0, ankleX: 0, ankleY: 0, ankleZ: 0, thigh: 0.45, calf: 0.45, strideCap: 0.9 };
      }
      const thighLen = Math.max(0.1, t.distanceTo(c));
      const calfLen = Math.max(0.1, c.distanceTo(f));
      // Max horizontal ankle excursion measured at the DOUBLE-SUPPORT dip:
      // the pelvis dips ~11cm when both feet are planted apart, which is
      // what unlocks the leg reach for the stride. Strides beyond the
      // envelope would clamp the IK and make the feet skate.
      const legLen = thighLen + calfLen;
      const drop = Math.max(0.05, t.y - f.y - 0.11);
      const reach = Math.sqrt(Math.max(0.01, legLen * legLen - drop * drop));
      return {
        hipY: t.y,
        hipZ: t.z,
        ankleX: f.x,
        ankleY: f.y,
        ankleZ: f.z,
        thigh: thighLen,
        calf: calfLen,
        strideCap: Math.max(0.5, 2 * reach * 0.95),
      };
    };
    rig.legL = measureLeg(rig.thighL, rig.calfL, rig.footL);
    rig.legR = measureLeg(rig.thighR, rig.calfR, rig.footR);

    // Ground & centre the model: soles rest exactly on y=0, body centred on
    // the entity origin (prevents the hovering look).
    const bb = new THREE.Box3().setFromObject(root);
    rig.groundX = -(bb.min.x + bb.max.x) / 2;
    rig.groundZ = -(bb.min.z + bb.max.z) / 2;
    rig.groundY = -bb.min.y;
    root.position.set(rig.groundX, rig.groundY, rig.groundZ);

    return rig;
  }

  private static composeOffset(rig: AllyRig, bone: THREE.Object3D | null, x: number, y = 0, z = 0) {
    if (!bone) return;
    const rest = rig.restPose.get(bone);
    if (!rest) return;
    _offsetQuat.setFromEuler(_offsetEuler.set(x, y, z));
    bone.quaternion.copy(rest).multiply(_offsetQuat);
  }

  /**
   * Rifle-ready stance. Bone local axes for this skeleton (measured
   * empirically): arms raise forward via local Y+, legs swing via local Z.
   */
  public static applyStance(rig: AllyRig) {
    // Gun hand (left/metal arm): raised to chest height, elbow bent
    this.composeOffset(rig, rig.upperArmL, 0, 1.5, 0);
    this.composeOffset(rig, rig.lowerArmL, 0, 0.7, 0);
    // Support hand (right): comes up and across to meet the gun's foregrip
    this.composeOffset(rig, rig.upperArmR, 0, 1.4, 0);
    this.composeOffset(rig, rig.lowerArmR, 0, 1.0, 0);
    // Slight forward combat lean (Z is the sagittal pitch axis)
    this.composeOffset(rig, rig.spine, 0, 0, 0.05);
  }

  /**
   * Speed-synced walk cycle with planted feet — call every frame with the
   * ally's ACTUAL movement speed (m/s). During a stance phase the foot is
   * swept backwards through body space at exactly the body speed (stride
   * length = speed * step-time), so soles never skate across the ground.
   * The pelvis bobs with the stride; idle blends smoothly back to stance.
   */
  public static updateGait(rig: AllyRig, delta: number, speed: number) {
    if (delta <= 0) return;
    rig.gait.lastRaw = speed;
    this.applyStance(rig);

    const g = rig.gait;
    g.speedSm += (speed - g.speedSm) * Math.min(1, delta * 6);
    const moving = g.speedSm > 0.15;
    g.weight += ((moving ? 1 : 0) - g.weight) * Math.min(1, delta * 8);
    const w = g.weight;

    if (w < 0.02) {
      // Idle: legs settle back onto their rest pose, feet on the floor
      this.solveLeg(rig, rig.legL, rig.thighL, rig.calfL, rig.footL, rig.legL.ankleX, rig.legL.ankleY, rig.legL.ankleZ);
      this.solveLeg(rig, rig.legR, rig.thighR, rig.calfR, rig.footR, rig.legR.ankleX, rig.legR.ankleY, rig.legR.ankleZ);
      rig.root.position.y = rig.groundY;
      return;
    }

    // Cadence-driven gait with distance-synced stance: cadence scales with
    // speed (sane 2.2–4.6 steps/s), and the stance amplitude S = 0.6·v/c
    // makes the planted foot sweep backwards at EXACTLY the body speed
    // (the foot is grounded for 60% of its cycle). Zero skating at any
    // speed; stride stays inside the leg's reach envelope (dip included).
    const cadence = THREE.MathUtils.clamp(g.speedSm / 0.9, 2.2, 4.6);
    const S = Math.min((0.6 * speed) / cadence, rig.legL.strideCap);
    g.phase = (g.phase + 2 * Math.PI * cadence * delta) % (Math.PI * 2);
    const stepH = THREE.MathUtils.clamp(0.04 * g.speedSm + 0.02, 0.03, 0.2);

    this.stepLeg(rig, rig.legL, rig.thighL, rig.calfL, rig.footL, g.phase, S, stepH, w);
    this.stepLeg(rig, rig.legR, rig.thighR, rig.calfR, rig.footR, g.phase + Math.PI, S, stepH, w);

    // Pelvis motion: DIP at double support (both feet apart — this is what
    // gives the legs the reach for the stride), level at mid-stance pass.
    const bob = -0.11 * Math.abs(Math.cos(g.phase)) * w;
    rig.root.position.y = rig.groundY + bob;
    this.composeOffset(rig, rig.spine, 0, 0, 0.05 + Math.sin(g.phase * 2) * 0.02 * w);
  }

  /** One leg's foot target for this point in the gait cycle, then IK it. */
  private static stepLeg(
    rig: AllyRig,
    leg: LegMetrics,
    thigh: THREE.Object3D | null,
    calf: THREE.Object3D | null,
    foot: THREE.Object3D | null,
    phase: number,
    stride: number,
    stepH: number,
    w: number
  ) {
    const u = ((phase / (Math.PI * 2)) % 1 + 1) % 1;
    let z = 0;
    let lift = 0;
    if (u < 0.6) {
      // STANCE (60% of the cycle): sole planted, sweeping backwards relative
      // to the body at exactly ground speed (amplitude S over 0.6/c seconds).
      const s = u / 0.6;
      z = stride / 2 - stride * s;
    } else {
      // SWING (40%): foot lifts and flies forward through the air — this is
      // what lets strides stay inside the leg's reach at run speed.
      const s = (u - 0.6) / 0.4;
      const e = s * s * (3 - 2 * s);
      z = -stride / 2 + stride * e;
      lift = Math.sin(Math.PI * s) * stepH;
    }
    // Blend the target toward the rest pose as gait weight ramps in/out.
    // The pelvis dip lowers the ROOT, so the stance target must rise by the
    // same amount to keep the planted sole exactly on the ground — without
    // this the planted foot sinks and drags with every step (skating).
    const dip = 0.11 * Math.abs(Math.cos(phase)) * w;
    const tx = leg.ankleX;
    const ty = leg.ankleY + lift * w + dip;
    const tz = leg.ankleZ + z * w;
    this.solveLeg(rig, leg, thigh, calf, foot, tx, ty, tz);
  }

  /**
   * Analytic 2-bone IK in the leg's sagittal plane. Local axes (measured):
   * thigh Z+ swings the knee forward, calf Z- flexes the knee. The foot is
   * pitch-compensated so the sole stays level on the ground.
   */
  private static solveLeg(
    rig: AllyRig,
    leg: LegMetrics,
    thigh: THREE.Object3D | null,
    calf: THREE.Object3D | null,
    foot: THREE.Object3D | null,
    tx: number,
    ty: number,
    tz: number
  ) {
    if (!thigh || !calf) return;

    const dy = leg.hipY - ty; // vertical drop hip -> ankle
    const dz = tz - leg.hipZ; // forward offset
    const L = leg.thigh + leg.calf;
    const d = THREE.MathUtils.clamp(Math.hypot(dy, dz), L * 0.35, L * 0.999);

    // Direction of the hip->ankle line measured from straight down
    const gamma = Math.atan2(dz, dy);
    // Alpha: how far the thigh must open off that line so the knee bends forward
    const cosA = THREE.MathUtils.clamp(
      (leg.thigh * leg.thigh + d * d - leg.calf * leg.calf) / (2 * leg.thigh * d), -1, 1
    );
    const phi = gamma + Math.acos(cosA);
    // Interior knee angle -> bend amount
    const cosK = THREE.MathUtils.clamp(
      (leg.thigh * leg.thigh + leg.calf * leg.calf - d * d) / (2 * leg.thigh * leg.calf), -1, 1
    );
    const kneeBend = Math.PI - Math.acos(cosK);

    this.composeOffset(rig, thigh, 0, 0, phi);
    this.composeOffset(rig, calf, 0, 0, -kneeBend);
    // Foot pitch compensation: total chain pitch is phi - kneeBend, so cancel
    // it to keep the sole flat (sign flips are handled by the rig's axes).
    if (foot) {
      this.composeOffset(rig, foot, 0, 0, kneeBend - phi);
    }
  }

  /**
   * Orient the rifle so its barrel (+Z of the gun group) points along the
   * character's forward (+Z of the entity root) regardless of the socket
   * bone's local axes. Must run with the stance applied — the hand pose is
   * static afterwards, so the computed local rotation stays valid.
   */
  public static orientRifleToForward(rig: AllyRig, rifle: THREE.Group) {
    const socket = rig.weaponSocketL || rig.handL;
    if (!socket) return;
    rig.root.updateMatrixWorld(true);
    const qSocketWorld = new THREE.Quaternion();
    socket.getWorldQuaternion(qSocketWorld);
    rifle.quaternion.copy(qSocketWorld.invert());
    rifle.position.set(0, 0, 0);
  }
}

// Scratch objects (module-level to avoid per-frame allocations)
const _offsetQuat = new THREE.Quaternion();
const _offsetEuler = new THREE.Euler();
