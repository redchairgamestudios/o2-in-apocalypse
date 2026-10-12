import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Static environment batching: the maps build 150-250 individual meshes
 * (buildings, roads, curbs, windows, props) that never move. Each one is a
 * separate draw call with its own state switch — on mobile that dominates
 * the CPU frame budget even though the geometry itself is trivial.
 *
 * mergeStaticEnvironment() bakes every mesh's world transform into its
 * geometry and merges all geometry sharing one material (and shadow flags)
 * into a single mesh. Draw calls drop from hundreds to a couple dozen while
 * keeping per-material frustum culling and raycasting intact.
 *
 * Meshes in `keep` (interactive objects, explosive barrels — anything
 * gameplay holds a direct reference to) are left untouched, as are
 * multi-material meshes and InstancedMeshes.
 */
export function mergeStaticEnvironment(group: THREE.Group, keep: THREE.Object3D[] = []): void {
  const keepSet = new Set(keep);

  group.updateMatrixWorld(true);

  interface Candidate {
    mesh: THREE.Mesh;
    key: string;
    cloned: THREE.BufferGeometry;
  }
  const candidates = new Map<string, Candidate[]>();
  const seen = new Set<THREE.Mesh>();

  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return;
    if ((mesh as unknown as { isInstancedMesh?: boolean }).isInstancedMesh) return;
    if (keepSet.has(mesh) || seen.has(mesh)) return;
    seen.add(mesh);

    const mat = mesh.material;
    if (Array.isArray(mat) || !mat) return; // multi-material: leave as-is

    const srcGeo = mesh.geometry;
    if (!srcGeo || srcGeo.groups.length > 1) return; // grouped geometry: leave as-is

    // mergeGeometries requires identical attribute sets and index state
    const attrKeys = Object.keys(srcGeo.attributes).sort().join(',');
    const indexed = !!srcGeo.index;

    const cloned = srcGeo.clone().applyMatrix4(mesh.matrixWorld);

    const key = `${mat.uuid}|${mesh.castShadow}|${mesh.receiveShadow}|${indexed}|${attrKeys}`;
    const list = candidates.get(key) || [];
    list.push({ mesh, key, cloned });
    candidates.set(key, list);
  });

  const toRemove: THREE.Mesh[] = [];
  const toDispose: THREE.BufferGeometry[] = [];

  candidates.forEach((list, key) => {
    const merged = mergeGeometries(
      list.map((c) => c.cloned),
      false
    );
    if (!merged) {
      // Incompatible attribute layouts — keep the original meshes for this bucket
      list.forEach((c) => c.cloned.dispose());
      return;
    }

    const first = list[0].mesh;
    merged.computeBoundingSphere();
    merged.computeBoundingBox();

    const mergedMesh = new THREE.Mesh(merged, first.material as THREE.Material);
    mergedMesh.castShadow = first.castShadow;
    mergedMesh.receiveShadow = first.receiveShadow;
    mergedMesh.matrixAutoUpdate = false;
    mergedMesh.name = `batched_${key.split('|')[0].slice(0, 12)}_${list.length}`;

    group.add(mergedMesh);
    list.forEach((c) => {
      toRemove.push(c.mesh);
      toDispose.push(c.cloned);
      // Original geometry is now baked into the merged mesh
      c.mesh.geometry.dispose();
    });
  });

  toRemove.forEach((m) => m.parent?.remove(m));
  toDispose.forEach((g) => g.dispose());
}
