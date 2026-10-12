import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * High-detail helicopter ("helicopter.glb", 46k verts, PBR textured).
 * Streams in the background; HelicopterModel.buildFuselage() wraps it into
 * the HelicopterInstance shape with working rotors, falling back to the
 * procedural Blackhawk until the stream completes.
 */

const MODEL_URL = '/assets/models/helicopter/helicopter.glb';

export class HelicopterAsset {
  private static template: THREE.Group | null = null;
  private static rotorMesh: THREE.Mesh | null = null;
  public static ready = false;
  private static loadPromise: Promise<void> | null = null;

  public static preload(): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise<void>((resolve) => {
      new GLTFLoader().load(
        MODEL_URL,
        (gltf) => {
          const scene = gltf.scene;
          scene.updateMatrixWorld(true);

          // Normalize to gameplay size: fuselage length ~9.5m, nose along -Z
          const bbox = new THREE.Box3().setFromObject(scene);
          const size = bbox.getSize(new THREE.Vector3());
          const length = Math.max(size.x, size.y, size.z);
          const scale = 9.5 / Math.max(0.01, length);
          scene.scale.setScalar(scale);

          // Longest axis -> Z
          scene.updateMatrixWorld(true);
          const size0 = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
          if (size0.x >= size0.z && size0.x >= size0.y) {
            scene.rotation.y += Math.PI / 2;
          } else if (size0.y >= size0.z) {
            scene.rotation.x += Math.PI / 2;
          }
          scene.updateMatrixWorld(true);

          // Center: length along Z, skids at y=0
          const bbox2 = new THREE.Box3().setFromObject(scene);
          const center = bbox2.getCenter(new THREE.Vector3());
          scene.position.x -= center.x;
          scene.position.z -= center.z;
          scene.position.y -= bbox2.min.y;
          scene.updateMatrixWorld(true);

          // Spin the authored rotor mesh (name match is generous)
          let rotor: THREE.Mesh | null = null;
          let rotorName: string | null = null;
          scene.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.frustumCulled = false;
            if (!rotor && /rotor|blade|prop/i.test(mesh.name || '')) {
              rotor = mesh;
              rotorName = mesh.name || 'rotor';
            }
          });
          this.rotorMesh = rotor;

          this.template = scene;
          this.ready = true;
          console.info(
            '%cO²%c Helicopter model loaded (helicopter.glb)' + (rotorName ? ' — rotor: ' + rotorName : ''),
            'background:#b91c1c;color:#fff;padding:1px 6px;border-radius:3px;font-weight:bold',
            'color:#aaa'
          );
          resolve();
        },
        undefined,
        (err) => {
          console.warn('helicopter.glb failed to load; using procedural Blackhawk.', err);
          resolve();
        }
      );
    });
    return this.loadPromise;
  }

  /** Clone of the authored helicopter (null until streamed). */
  public static getTemplate(): THREE.Group | null {
    return this.ready && this.template ? this.template.clone(true) : null;
  }

  /** The authored rotor mesh found inside a built instance (for spin animation). */
  public static findRotor(root: THREE.Object3D): THREE.Mesh | null {
    const name = this.rotorMesh?.name;
    if (!name) return null;
    let found: THREE.Mesh | null = null;
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!found && mesh.isMesh && mesh.name === name) found = mesh;
    });
    return found;
  }
}
