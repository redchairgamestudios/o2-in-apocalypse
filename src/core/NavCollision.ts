import * as THREE from 'three';

/**
 * Shared agent-vs-world collision. The mission environment publishes its
 * collider boxes here once per map load; zombies, squad allies and the drone
 * all resolve against them so nothing walks/flys through buildings.
 */
export class NavCollision {
  private static boxes: THREE.Box3[] = [];
  private static bounds: { minX: number; maxX: number; minZ: number; maxZ: number } = {
    minX: -115, maxX: 115, minZ: -145, maxZ: 155,
  };

  public static setColliders(boxes: THREE.Box3[], bounds?: { minX: number; maxX: number; minZ: number; maxZ: number }) {
    this.boxes = boxes || [];
    if (bounds) this.bounds = bounds;
  }

  public static clear() {
    this.boxes = [];
  }

  /**
   * Push a ground agent (radius) out of any building box it intersects.
   * Only the horizontal plane is resolved — agents keep their own gravity.
   * Returns true when a correction was applied.
   */
  public static resolve(pos: THREE.Vector3, radius: number, agentHeight = 1.8): boolean {
    let corrected = false;
    const feetY = pos.y;
    const headY = pos.y + agentHeight;

    for (const box of this.boxes) {
      // Vertical overlap with the obstacle?
      if (headY <= box.min.y || feetY + 0.45 >= box.max.y) continue;

      // Deep containment check — must be inside the box footprint (expanded by radius)
      if (
        pos.x <= box.min.x - radius || pos.x >= box.max.x + radius ||
        pos.z <= box.min.z - radius || pos.z >= box.max.z + radius
      ) {
        continue;
      }

      // Push out along the shallowest face
      const pushL = Math.abs(pos.x - (box.min.x - radius)); // distance to west face
      const pushR = Math.abs(box.max.x + radius - pos.x);
      const pushB = Math.abs(pos.z - (box.min.z - radius));
      const pushF = Math.abs(box.max.z + radius - pos.z);
      const minPush = Math.min(pushL, pushR, pushB, pushF);

      if (minPush === pushL) pos.x = box.min.x - radius;
      else if (minPush === pushR) pos.x = box.max.x + radius;
      else if (minPush === pushB) pos.z = box.min.z - radius;
      else pos.z = box.max.z + radius;
      corrected = true;
    }

    // Keep inside the district bounds
    pos.x = THREE.MathUtils.clamp(pos.x, this.bounds.minX, this.bounds.maxX);
    pos.z = THREE.MathUtils.clamp(pos.z, this.bounds.minZ, this.bounds.maxZ);
    return corrected;
  }

  /**
   * Flying agent (drone): 3D push-out — only when inside the building volume.
   */
  public static resolveFlying(pos: THREE.Vector3, radius: number): boolean {
    let corrected = false;
    for (const box of this.boxes) {
      if (
        pos.x <= box.min.x - radius || pos.x >= box.max.x + radius ||
        pos.z <= box.min.z - radius || pos.z >= box.max.z + radius ||
        pos.y <= box.min.y - radius || pos.y >= box.max.y + radius
      ) {
        continue;
      }

      const pushL = Math.abs(pos.x - (box.min.x - radius));
      const pushR = Math.abs(box.max.x + radius - pos.x);
      const pushB = Math.abs(pos.z - (box.min.z - radius));
      const pushF = Math.abs(box.max.z + radius - pos.z);
      const pushD = Math.abs(box.max.y + radius - pos.y); // pop above the roof
      const minPush = Math.min(pushL, pushR, pushB, pushF, pushD);

      if (minPush === pushL) pos.x = box.min.x - radius;
      else if (minPush === pushR) pos.x = box.max.x + radius;
      else if (minPush === pushB) pos.z = box.min.z - radius;
      else if (minPush === pushF) pos.z = box.max.z + radius;
      else pos.y = box.max.y + radius;
      corrected = true;
    }
    return corrected;
  }

  /** Is a world point inside any building (with margin)? Used to validate spawn positions. */
  public static isBlocked(x: number, z: number, margin = 1.0, y = 0): boolean {
    for (const box of this.boxes) {
      if (
        x > box.min.x - margin && x < box.max.x + margin &&
        z > box.min.z - margin && z < box.max.z + margin &&
        y < box.max.y - 0.5
      ) {
        return true;
      }
    }
    return false;
  }
}
