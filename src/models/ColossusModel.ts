import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { ZombieConfig } from '../types';

/**
 * "Blind Hunter" boss model (BindHunter.fbx) — replaces the melty colossus.
 * Static sculpt (no rig): the boss shambles on root motion with a procedural
 * sway, and PBR materials are assembled from the supplied texture set.
 */

const MODEL_URL = '/assets/models/colossus/BindHunter.fbx';
const TEX = '/assets/models/colossus/';
const TARGET_HEIGHT = 1.55; // × config.scale 2.2 ≈ 3.4m Goliath

export interface ColossusRig {
  root: THREE.Group;
  weakpointMesh?: THREE.Mesh;
}

export class ColossusModel {
  private static template: THREE.Group | null = null;
  private static modelHeight = 1;
  public static ready = false;
  private static loadPromise: Promise<void> | null = null;

  public static preload(): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise<void>((resolve) => {
      const loader = new FBXLoader();
      loader.load(
        MODEL_URL,
        (fbx) => {
          fbx.updateMatrixWorld(true);

          // Build the PBR material set from the supplied textures
          const texLoader = new THREE.TextureLoader();
          const baseColor = texLoader.load(TEX + 'BindHunter_Blind_Hunter_BaseColor.png');
          const normalMap = texLoader.load(TEX + 'BindHunter_Blind_Hunter_Normal.png');
          const roughnessMap = texLoader.load(TEX + 'BindHunter_Blind_Hunter_Roughness.png');
          const metallicMap = texLoader.load(TEX + 'BindHunter_Blind_Hunter_Metallic.png');
          const aoMap = texLoader.load(TEX + 'Blind_Hunter_Mixed_AO.png');
          for (const t of [baseColor, normalMap, roughnessMap, metallicMap, aoMap]) {
            t.colorSpace = t === baseColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
            t.anisotropy = 4;
          }

          const mat = new THREE.MeshStandardMaterial({
            map: baseColor,
            normalMap,
            roughnessMap,
            metalnessMap: metallicMap,
            aoMap,
            aoMapIntensity: 0.9,
            roughness: 1.0,
            metalness: 1.0,
            envMapIntensity: 0.6,
          });

          fbx.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (!mesh.isMesh) return;
            // Boss is huge & skinned — its shadow pass re-renders the entire
            // mesh every frame. Env shadows already ground the scene.
            mesh.castShadow = false;
            mesh.frustumCulled = false;
            mesh.material = mat;
            // aoMap samples the second UV channel — clone UV when absent
            if (mesh.geometry && !mesh.geometry.getAttribute('uv1') && mesh.geometry.getAttribute('uv')) {
              mesh.geometry.setAttribute('uv1', mesh.geometry.getAttribute('uv'));
            }
          });

          const bbox = new THREE.Box3().setFromObject(fbx);
          const size = new THREE.Vector3();
          bbox.getSize(size);
          this.modelHeight = Math.max(0.01, size.y);
          // Feet at y = 0 so the boss stands on the ground
          fbx.position.y -= bbox.min.y;
          this.template = fbx;
          this.ready = true;
          console.info(
            '%cO²%c Boss model loaded (Blind Hunter)',
            'background:#b91c1c;color:#fff;padding:1px 6px;border-radius:3px;font-weight:bold',
            'color:#aaa'
          );
          resolve();
        },
        undefined,
        (err) => {
          console.warn('BindHunter FBX failed to load; colossus keeps the melty model.', err);
          resolve();
        }
      );
    });
    return this.loadPromise;
  }

  /**
   * Build one boss instance: scaled static mesh + hitboxes + pulsing weakpoint.
   * Hitboxes are returned UNPARENTED in world-scale units — the caller adds
   * them to the zombie's unscaled outer group so they stay world-sized.
   * Returns null while the FBX is still streaming (caller falls back).
   */
  public static createRig(zombieId: string, config: ZombieConfig): {
    root: THREE.Group;
    hitboxMeshes: THREE.Mesh[];
    headMesh: THREE.Mesh;
    weakpointMesh: THREE.Mesh;
    worldHeight: number;
  } | null {
    if (!this.template || !this.ready) return null;

    const scale = TARGET_HEIGHT / this.modelHeight * (config.scale || 1.0);
    const root = new THREE.Group();
    root.name = `colossus_${zombieId}`;
    root.add(this.template.clone(true)); // clone: the template is a shared singleton
    root.scale.setScalar(scale);

    const worldHeight = TARGET_HEIGHT * (config.scale || 1.0);
    const hitboxMeshes: THREE.Mesh[] = [];
    const makeHitbox = (radius: number, zone: 'HEAD' | 'TORSO' | 'WEAKPOINT'): THREE.Mesh => {
      const geo = new THREE.SphereGeometry(radius, 8, 6);
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
      mesh.userData.hitZone = zone;
      mesh.userData.zombieId = zombieId;
      mesh.userData.isHitbox = true;
      hitboxMeshes.push(mesh);
      return mesh;
    };

    // World-scale proportions (added to the UNSCALED outer group by the caller)
    const head = makeHitbox(worldHeight * 0.15, 'HEAD');
    head.position.set(0, worldHeight * 0.88, 0.05);

    const torsoA = makeHitbox(worldHeight * 0.22, 'TORSO');
    torsoA.position.set(0, worldHeight * 0.62, 0);

    const torsoB = makeHitbox(worldHeight * 0.24, 'TORSO');
    torsoB.position.set(0, worldHeight * 0.35, 0);

    // Pulsing glowing weakpoint on the chest
    const weakpointMesh = new THREE.Mesh(
      new THREE.SphereGeometry(worldHeight * 0.13, 10, 8),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3b1f).multiplyScalar(2.8) })
    );
    weakpointMesh.position.set(0, worldHeight * 0.6, worldHeight * 0.09);
    weakpointMesh.userData.hitZone = 'WEAKPOINT';
    weakpointMesh.userData.zombieId = zombieId;
    weakpointMesh.userData.isHitbox = true;
    hitboxMeshes.push(weakpointMesh);

    return { root, hitboxMeshes, headMesh: head, weakpointMesh, worldHeight };
  }
}
