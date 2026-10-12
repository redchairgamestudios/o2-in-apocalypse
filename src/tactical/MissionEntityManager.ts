import * as THREE from 'three';
import { NavCollision } from '../core/NavCollision';

/**
 * Mission 11 world entities: stranded SURVIVORS to escort-rescue and research
 * SAMPLE cases to collect. Each entity carries a tall light-beacon marker so
 * objectives are visible across the map — no more wandering toward blank space.
 */

export interface SurvivorEntity {
  id: string;
  group: THREE.Group;
  position: THREE.Vector3;
  rescued: boolean;
  wave: number;
  waveTimer: number;
}

export interface SampleEntity {
  id: string;
  group: THREE.Group;
  position: THREE.Vector3;
  collected: boolean;
}

export interface RescueEvents {
  onSurvivorRescued: (id: string) => void;
  onSampleCollected: (id: string) => void;
}

export class MissionEntityManager {
  private static scene: THREE.Scene | null = null;
  private static survivors: SurvivorEntity[] = [];
  private static samples: SampleEntity[] = [];
  private static events: RescueEvents | null = null;
  // The ACTIVE objective's physical task pointer (console + beacon)
  private static taskPointer: THREE.Group | null = null;
  private static taskPointerLight: THREE.PointLight | null = null;
  private static pointerTime: number = 0;

  public static init(scene: THREE.Scene, events: RescueEvents) {
    this.scene = scene;
    this.events = events;
    this.survivors = [];
    this.samples = [];
  }

  public static clearAll() {
    if (this.scene) {
      for (const s of this.survivors) this.scene.remove(s.group);
      for (const s of this.samples) this.scene.remove(s.group);
    }
    this.survivors = [];
    this.samples = [];
    this.clearTaskPointer();
  }

  /**
   * OBJECTIVE TASK POINTER — a physical field console marking where the next
   * task triggers (same family as the generator): steel pedestal, angled
   * glowing screen, antenna with blinking tip light, holo beacon pillar and
   * a floating rotating chevron. Objectives are never "random places".
   */
  public static placeTaskPointer(
    scene: THREE.Scene,
    position: THREE.Vector3,
    color: number,
    kind: 'INTERACT' | 'REACH' | 'BOSS'
  ): THREE.Group {
    this.clearTaskPointer();
    this.scene = scene;

    const g = new THREE.Group();
    g.name = `task_pointer_${kind.toLowerCase()}`;
    g.position.set(position.x, 0, position.z);

    const accent = new THREE.Color(color);
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.45, metalness: 0.75 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.6, metalness: 0.4 });

    // Pedestal base
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.5, 0.85), steelMat);
    base.position.y = 0.25;
    base.castShadow = true;
    base.receiveShadow = true;
    g.add(base);

    // Angled console body with glowing screen
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.72, 0.16), steelMat);
    body.position.set(0, 0.86, 0.1);
    body.rotation.x = -0.42;
    body.castShadow = true;
    g.add(body);

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.82, 0.5),
      new THREE.MeshBasicMaterial({ color: accent.clone().multiplyScalar(1.8), transparent: true })
    );
    screen.position.set(0, 0.87, 0.19);
    screen.rotation.x = -0.42;
    screen.name = 'task_pointer_screen';
    g.add(screen);

    // Side trims
    for (const sx of [-0.56, 0.56]) {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.5), trimMat);
      trim.position.set(sx, 0.55, 0);
      g.add(trim);
    }

    // Antenna mast + blinking tip
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.1, 6), trimMat);
    mast.position.set(-0.42, 1.55, -0.28);
    g.add(mast);
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 8),
      new THREE.MeshBasicMaterial({ color: accent.clone().multiplyScalar(2.4) })
    );
    tip.position.set(-0.42, 2.62, -0.28);
    tip.name = 'task_pointer_tip';
    g.add(tip);

    // Holo beacon pillar + floating chevron pointing down at the console
    const beacon = this.createBeacon(color, kind === 'BOSS' ? 14 : 11);
    g.add(beacon);

    const chevron = new THREE.Mesh(
      new THREE.ConeGeometry(0.34, 0.62, 4),
      new THREE.MeshBasicMaterial({ color: accent.clone().multiplyScalar(2.0) })
    );
    chevron.rotation.x = Math.PI;
    chevron.position.y = 3.4;
    chevron.name = 'task_pointer_chevron';
    g.add(chevron);

    // Pulsing accent light
    const light = new THREE.PointLight(color, 3.2, 12, 2.0);
    light.position.set(0, 1.6, 0);
    g.add(light);
    this.taskPointerLight = light;

    scene.add(g);
    this.taskPointer = g;
    return g;
  }

  public static clearTaskPointer() {
    if (this.taskPointer && this.taskPointer.parent) {
      this.taskPointer.parent.remove(this.taskPointer);
    }
    this.taskPointer = null;
    this.taskPointerLight = null;
  }

  /** Animate the active task pointer (blinking tip, spinning chevron, pulsing light). */
  public static updateTaskPointer(delta: number) {
    if (!this.taskPointer) return;
    this.pointerTime += delta;

    const chevron = this.taskPointer.getObjectByName('task_pointer_chevron');
    if (chevron) {
      chevron.rotation.y += delta * 2.2;
      chevron.position.y = 3.4 + Math.sin(this.pointerTime * 2.4) * 0.22;
    }
    const tip = this.taskPointer.getObjectByName('task_pointer_tip');
    if (tip) {
      tip.visible = (this.pointerTime % 0.8) < 0.5;
    }
    const screen = this.taskPointer.getObjectByName('task_pointer_screen') as THREE.Mesh | undefined;
    if (screen) {
      const mat = screen.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.8 + Math.sin(this.pointerTime * 3.0) * 0.2;
    }
    if (this.taskPointerLight) {
      this.taskPointerLight.intensity = 2.6 + Math.sin(this.pointerTime * 3.0) * 1.2;
    }
  }

  /** Light beacon: a tall glowing pillar + floating diamond, always readable. */
  public static createBeacon(color: number, height: number): THREE.Group {
    const beacon = new THREE.Group();
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, height, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(1.6),
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    pillar.position.y = height / 2;
    beacon.add(pillar);

    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2) })
    );
    diamond.position.y = height + 0.7;
    diamond.name = 'beacon_diamond';
    beacon.add(diamond);

    return beacon;
  }

  /** Spawn a crouching survivor with a waving gesture at a validated open spot. */
  public static spawnSurvivor(id: string, pos: THREE.Vector3): SurvivorEntity {
    const group = new THREE.Group();
    group.name = `survivor_${id}`;

    const clothMat = new THREE.MeshStandardMaterial({ color: 0x546e7a, roughness: 0.85 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd7b8a3, roughness: 0.7 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.42, 6, 12), clothMat);
    torso.position.y = 0.62;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), skinMat);
    head.position.y = 1.16;
    group.add(head);

    // Waving arm — the universal "over here!" signal
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.5, 4, 8), clothMat);
    arm.position.set(0.34, 1.0, 0);
    arm.rotation.z = -2.2;
    arm.name = 'waving_arm';
    group.add(arm);

    const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 4, 10), clothMat);
    legs.position.y = 0.3;
    legs.scale.set(1.3, 1, 1);
    group.add(legs);

    // Beacon marker: cyan pillar, 14m tall
    const beacon = this.createBeacon(0x22d3ee, 14);
    group.add(beacon);

    group.position.copy(pos);
    group.position.y = 0;
    this.scene?.add(group);

    const entity: SurvivorEntity = { id, group, position: pos.clone(), rescued: false, wave: 0, waveTimer: 0 };
    this.survivors.push(entity);
    return entity;
  }

  /** Spawn a glowing research sample case. */
  public static spawnSample(id: string, pos: THREE.Vector3): SampleEntity {
    const group = new THREE.Group();
    group.name = `sample_${id}`;

    // Biohazard case
    const caseMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.4, metalness: 0.3 });
    const caseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.4), caseMat);
    caseMesh.position.y = 0.5;
    caseMesh.castShadow = true;
    group.add(caseMesh);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.57, 0.1, 0.42),
      new THREE.MeshBasicMaterial({ color: 0x111111 })
    );
    stripe.position.y = 0.5;
    group.add(stripe);

    // Beacon marker: amber pillar, 12m tall
    const beacon = this.createBeacon(0xf59e0b, 12);
    group.add(beacon);

    group.position.copy(pos);
    group.position.y = 0;
    this.scene?.add(group);

    const entity: SampleEntity = { id, group, position: pos.clone(), collected: false };
    this.samples.push(entity);
    return entity;
  }

  /** All entities stand/wave/beacon-animate + rescue & pickup proximity checks. */
  public static update(delta: number, playerPos: THREE.Vector3, interactPressed: boolean) {
    const now = performance.now() * 0.004;

    // Survivors: wave animation + beacon bob; [E] rescue when close
    for (const s of this.survivors) {
      if (s.rescued) continue;
      const arm = s.group.getObjectByName('waving_arm');
      if (arm) {
        arm.rotation.z = -2.2 + Math.sin(now * 3) * 0.35;
      }
      const diamond = s.group.getObjectByName('beacon_diamond');
      if (diamond) {
        diamond.rotation.y += delta * 2.4;
        diamond.position.y = 14.7 + Math.sin(now * 2) * 0.25;
      }

      const dist = s.position.distanceTo(playerPos);
      if (dist <= 2.6) {
        if (interactPressed) {
          s.rescued = true;
          s.group.visible = false; // survivor "leaves" with the evac bird
          this.events?.onSurvivorRescued(s.id);
        }
      }
    }

    // Samples: spin + auto-collect on walk-over
    for (const s of this.samples) {
      if (s.collected) continue;
      const caseMesh = s.group.children[0] as THREE.Mesh;
      if (caseMesh) caseMesh.rotation.y += delta * 1.8;
      const diamond = s.group.getObjectByName('beacon_diamond');
      if (diamond) {
        diamond.rotation.y += delta * 2.4;
        diamond.position.y = 12.7 + Math.sin(now * 2) * 0.25;
      }

      if (s.position.distanceTo(playerPos) <= 1.8) {
        s.collected = true;
        s.group.visible = false;
        this.events?.onSampleCollected(s.id);
      }
    }
  }

  public static getRemainingSurvivors(): number {
    return this.survivors.filter((s) => !s.rescued).length;
  }

  public static getRemainingSamples(): number {
    return this.samples.filter((s) => !s.collected).length;
  }

  /** Nearest unfinished entity position (for HUD beacons/distance). */
  public static getNearestTarget(playerPos: THREE.Vector3, kind: 'survivor' | 'sample'): THREE.Vector3 | null {
    const pool = (kind === 'survivor' ? this.survivors : this.samples).filter(
      (e) => !(kind === 'survivor' ? (e as SurvivorEntity).rescued : (e as SampleEntity).collected)
    );
    let best: THREE.Vector3 | null = null;
    let bestDist = Infinity;
    for (const e of pool) {
      const d = e.position.distanceTo(playerPos);
      if (d < bestDist) {
        bestDist = d;
        best = e.position.clone();
      }
    }
    return best;
  }

  /** Pick an open world spot: rings outward from a seed, collider-validated. */
  public static findOpenSpot(seedX: number, seedZ: number): THREE.Vector3 {
    const base = new THREE.Vector3(
      THREE.MathUtils.clamp(seedX, -100, 100),
      0,
      THREE.MathUtils.clamp(seedZ, -130, 140)
    );
    if (!NavCollision.isBlocked(base.x, base.z, 1.4)) return base;
    for (let ring = 1; ring <= 14; ring++) {
      for (let a = 0; a < 14; a++) {
        const ang = (a / 14) * Math.PI * 2;
        const probe = new THREE.Vector3(
          base.x + Math.cos(ang) * ring * 2.2,
          0,
          base.z + Math.sin(ang) * ring * 2.2
        );
        probe.x = THREE.MathUtils.clamp(probe.x, -100, 100);
        probe.z = THREE.MathUtils.clamp(probe.z, -130, 140);
        if (!NavCollision.isBlocked(probe.x, probe.z, 1.4)) return probe;
      }
    }
    return base;
  }
}
