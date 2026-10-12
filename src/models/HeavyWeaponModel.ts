import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * High-poly heavy machine gun viewmodel ("heavyrifleX.glb").
 * Preloaded once in the background; WeaponModelFactory falls back to the
 * procedural heavy until the stream completes. The FP group is built once
 * and reused across equip cycles (never disposed).
 */

const MODEL_URL = '/assets/models/weapons/heavyrifleX.glb';
const TARGET_LENGTH = 0.88; // world units of weapon length in first person
const BARREL_POINTS_NEG_Z = true; // set false if the render shows it backwards

export class HeavyWeaponModel {
  private static fpGroup: THREE.Group | null = null;
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

          // Normalize orientation: weapon length must run along Z (barrel -> -Z)
          const bbox0 = new THREE.Box3().setFromObject(scene);
          const size0 = new THREE.Vector3();
          bbox0.getSize(size0);
          if (size0.y >= size0.z && size0.y >= size0.x) {
            scene.rotation.x += Math.PI / 2; // length on Y -> Z
          } else if (size0.x > size0.z) {
            scene.rotation.y += Math.PI / 2; // length on X -> Z
          }
          if (!BARREL_POINTS_NEG_Z) {
            scene.rotation.y += Math.PI;
          }
          scene.updateMatrixWorld(true);

          // Center the weapon at the group origin
          const bbox = new THREE.Box3().setFromObject(scene);
          const center = new THREE.Vector3();
          bbox.getCenter(center);
          scene.position.sub(center);
          scene.updateMatrixWorld(true);

          // Scale so the weapon spans TARGET_LENGTH along Z
          const size = new THREE.Vector3();
          bbox.getSize(size);
          const scale = TARGET_LENGTH / Math.max(0.01, size.z);

          const group = new THREE.Group();
          group.name = 'heavy_rifle_gltf';
          group.scale.setScalar(scale);
          group.add(scene);

          scene.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.frustumCulled = false;
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (mat && 'metalness' in mat) {
              mat.metalness = Math.max(mat.metalness, 0.35);
              mat.roughness = Math.min(mat.roughness, 0.55);
              mat.envMapIntensity = 1.0;
            }
          });

          this.fpGroup = group;
          this.ready = true;
          console.info(
            '%cO²%c Heavy weapon model loaded (heavyrifleX)',
            'background:#b91c1c;color:#fff;padding:1px 6px;border-radius:3px;font-weight:bold',
            'color:#aaa'
          );
          resolve();
        },
        undefined,
        (err) => {
          console.warn('Heavy rifle GLB failed to load, using procedural model.', err);
          resolve();
        }
      );
    });
    return this.loadPromise;
  }

  /** Built first-person group (null until loaded). */
  public static getGroup(): THREE.Group | null {
    return this.fpGroup;
  }
}
