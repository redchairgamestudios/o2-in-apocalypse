import * as THREE from 'three';
import { ProceduralTextures } from '../textures/ProceduralTextures';
import { SubstationMap } from './maps/SubstationMap';
import { FreightDepotMap } from './maps/FreightDepotMap';
import { CheckpointBravoMap } from './maps/CheckpointBravoMap';
import { CentralPlazaMap } from './maps/CentralPlazaMap';
import { AirfieldHangarMap } from './maps/AirfieldHangarMap';

export interface InteractiveObject {
  id: string;
  type: 'GENERATOR' | 'SAFEHOUSE' | 'CRATE';
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  radius: number;
  label: string;
  isActivated: boolean;
}

export interface NarrowPathSpawn {
  spawn: THREE.Vector3;
  exitPoint: THREE.Vector3;
  name?: string;
}

export interface KeepOutZone {
  x: number;
  z: number;
  r: number;
}

export interface MapBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface EnvironmentResult {
  sceneGroup: THREE.Group;
  colliderBoxes: THREE.Box3[];
  interactiveObjects: InteractiveObject[];
  explosiveBarrels: { mesh: THREE.Mesh; position: THREE.Vector3; hp: number; exploded: boolean }[];
  safehouseZone: { position: THREE.Vector3; radius: number };
  playerSpawn: THREE.Vector3;
  spawnPoints: THREE.Vector3[];
  narrowPathSpawns: NarrowPathSpawn[];
  bounds: MapBounds;
  fogColor: number;
  fogDensity: number;
  ambientColor: number;
  ambientIntensity: number;
  directionalColor: number;
  directionalIntensity: number;
  directionalPos: [number, number, number];
}

/**
 * Deterministic PRNG so every mission layout is identical between runs.
 */
function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Scatter a field of hurdles (jersey barriers, crate stacks, concrete pipes
 * and tire stacks) across a rectangle on a jittered grid so pieces never
 * overlap. Cells inside any keep-out zone (objectives, spawns, cover
 * clusters) are skipped.
 */
export function createHurdleField(
  root: THREE.Group,
  colliderBoxes: THREE.Box3[],
  opts: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    keepOut: KeepOutZone[];
    count?: number;
    seed?: number;
  }
): void {
  const { minX, maxX, minZ, maxZ, keepOut } = opts;
  const count = opts.count ?? 64;
  const rand = seededRand(opts.seed ?? 1337);

  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.85, metalness: 0.08 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a6b42, roughness: 0.9, metalness: 0.05 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.95 });

  const inKeepOut = (x: number, z: number, r: number) =>
    keepOut.some((k) => Math.hypot(x - k.x, z - k.z) < k.r + r);

  const cell = 9;
  const cols = Math.max(1, Math.floor((maxX - minX) / cell));
  const rows = Math.max(1, Math.floor((maxZ - minZ) / cell));
  const cells: Array<{ x: number; z: number }> = [];
  for (let cx = 0; cx < cols; cx++) {
    for (let cz = 0; cz < rows; cz++) {
      cells.push({
        x: minX + cell * (cx + 0.5) + (rand() - 0.5) * 4,
        z: minZ + cell * (cz + 0.5) + (rand() - 0.5) * 4,
      });
    }
  }
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  let placed = 0;
  for (const c of cells) {
    if (placed >= count) break;
    if (inKeepOut(c.x, c.z, 2.4)) continue;

    const kind = Math.floor(rand() * 4);
    const rot = rand() * Math.PI;
    const piece = new THREE.Group();
    piece.position.set(c.x, 0, c.z);
    piece.rotation.y = rot;

    if (kind === 0) {
      // Jersey barrier
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.05, 0.8), concreteMat);
      m.position.y = 0.52;
      m.castShadow = true;
      m.receiveShadow = true;
      piece.add(m);
      const box = new THREE.Box3();
      box.setFromCenterAndSize(piece.position, new THREE.Vector3(2.6, 1.1, 2.6));
      colliderBoxes.push(box);
    } else if (kind === 1) {
      // Wooden crate stack
      for (let s = 0; s < 3; s++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 1.15), woodMat);
        m.position.set((rand() - 0.5) * 0.5, 0.58 + s * 1.16, (rand() - 0.5) * 0.5);
        m.rotation.y = rand() * 0.6;
        m.castShadow = true;
        piece.add(m);
      }
      const box = new THREE.Box3();
      box.setFromCenterAndSize(piece.position, new THREE.Vector3(2.2, 3.6, 2.2));
      colliderBoxes.push(box);
    } else if (kind === 2) {
      // Concrete pipe lying on its side
      const geo = new THREE.CylinderGeometry(0.85, 0.85, 2.1, 12, 1, true);
      geo.rotateZ(Math.PI / 2);
      const m = new THREE.Mesh(geo, concreteMat);
      m.position.y = 0.85;
      m.castShadow = true;
      m.receiveShadow = true;
      piece.add(m);
      const box = new THREE.Box3();
      box.setFromCenterAndSize(piece.position, new THREE.Vector3(2.3, 1.8, 2.3));
      colliderBoxes.push(box);
    } else {
      // Tire stack — low walkable obstacle, no collider
      for (let s = 0; s < 3; s++) {
        const geo = new THREE.TorusGeometry(0.55, 0.22, 8, 14);
        geo.rotateX(Math.PI / 2);
        const m = new THREE.Mesh(geo, tireMat);
        m.position.y = 0.24 + s * 0.42;
        m.castShadow = true;
        piece.add(m);
      }
    }

    root.add(piece);
    placed++;
  }
}

export class EnvironmentBuilder {
  public static buildQuarantineDistrict(): EnvironmentResult {
    const root = new THREE.Group();
    root.name = 'quarantine_district';

    const colliderBoxes: THREE.Box3[] = [];
    const interactiveObjects: InteractiveObject[] = [];
    const explosiveBarrels: { mesh: THREE.Mesh; position: THREE.Vector3; hp: number; exploded: boolean }[] = [];

    // Textures
    const asphaltTex = ProceduralTextures.getAsphalt();
    asphaltTex.repeat.set(4, 24);

    const concreteTex = ProceduralTextures.getConcreteWall();
    concreteTex.repeat.set(3, 4);

    const brickTex = ProceduralTextures.getBrickWall();
    brickTex.repeat.set(4, 6);

    const windowTex = ProceduralTextures.getBuildingWindows();
    windowTex.repeat.set(2, 3);

    const storefrontTex = ProceduralTextures.getStorefront();
    const hazardTex = ProceduralTextures.getHazardStripes();
    const rustTex = ProceduralTextures.getRustedMetal();
    const woodTex = ProceduralTextures.getWoodPlanks();

    // Shared Materials
    const concreteMat = new THREE.MeshStandardMaterial({
      map: concreteTex,
      roughness: 0.85,
      metalness: 0.1,
    });

    const brickMat = new THREE.MeshStandardMaterial({
      map: brickTex,
      roughness: 0.8,
      metalness: 0.05,
    });

    const darkTrimMat = new THREE.MeshStandardMaterial({
      color: 0x181a20,
      roughness: 0.7,
      metalness: 0.3,
    });

    const steelMat = new THREE.MeshStandardMaterial({
      map: rustTex,
      roughness: 0.55,
      metalness: 0.65,
    });

    // ==========================================
    // 1. GROUND (Main Avenue, Alleys & Plazas)
    // ==========================================
    // Street and alley asphalt surface (vastly expanded 240m x 320m coverage)
    const roadGeo = new THREE.PlaneGeometry(240, 320);
    roadGeo.rotateX(-Math.PI / 2);
    const roadMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: 0.75,
      metalness: 0.15,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.position.set(0, 0, 0);
    roadMesh.receiveShadow = true;
    root.add(roadMesh);

    // Sidewalks (expanded 260m long promenade)
    const sidewalkMat = new THREE.MeshStandardMaterial({
      map: concreteTex,
      roughness: 0.9,
    });

    const walkGeo = new THREE.BoxGeometry(6.5, 0.3, 260);
    const leftWalk = new THREE.Mesh(walkGeo, sidewalkMat);
    leftWalk.position.set(-12.0, 0.15, 0);
    leftWalk.receiveShadow = true;
    root.add(leftWalk);

    const rightWalk = new THREE.Mesh(walkGeo, sidewalkMat);
    rightWalk.position.set(12.0, 0.15, 0);
    rightWalk.receiveShadow = true;
    root.add(rightWalk);

    // Sidewalk Curbs (bevel border)
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x272a30, roughness: 0.8 });
    const curbGeo = new THREE.BoxGeometry(0.3, 0.32, 260);
    const leftCurb = new THREE.Mesh(curbGeo, curbMat);
    leftCurb.position.set(-8.75, 0.16, 0);
    root.add(leftCurb);

    const rightCurb = new THREE.Mesh(curbGeo, curbMat);
    rightCurb.position.set(8.75, 0.16, 0);
    root.add(rightCurb);

    // Crosswalk zebra stripes
    const crosswalkGeo = new THREE.BoxGeometry(1.2, 0.02, 5.5);
    const crosswalkMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 });
    [-75, -34, 8, 55].forEach((cwZ) => {
      for (let cx = -7.5; cx <= 7.5; cx += 2.0) {
        const stripe = new THREE.Mesh(crosswalkGeo, crosswalkMat);
        stripe.position.set(cx, 0.02, cwZ);
        root.add(stripe);
      }
    });

    // Manhole covers & sewer drain grates
    const manholeGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.04, 16);
    const manholeMat = new THREE.MeshStandardMaterial({ color: 0x1f2126, metalness: 0.8, roughness: 0.5 });
    [-65, -42, -22, 18, 38, 72].forEach((mZ, idx) => {
      const mh = new THREE.Mesh(manholeGeo, manholeMat);
      mh.position.set((idx % 2 === 0 ? -3.5 : 3.5), 0.02, mZ);
      root.add(mh);
    });

    // ==========================================
    // 2. DETAILED 3D ARCHITECTURAL BUILDINGS
    // ==========================================
    const createDetailedBuilding = (
      x: number,
      z: number,
      width: number,
      height: number,
      depth: number,
      style: 'BRICK' | 'CONCRETE' | 'OFFICE',
      hasStorefront: boolean = true,
      hasFireEscape: boolean = false,
      hasWaterTower: boolean = false
    ) => {
      const bGroup = new THREE.Group();
      bGroup.position.set(x, 0, z);

      const isLeftSide = x < 0;
      const frontFaceX = isLeftSide ? width / 2 : -width / 2;

      // 1. Main Core Structure
      const coreMat = style === 'BRICK' ? brickMat : concreteMat;
      const coreGeo = new THREE.BoxGeometry(width, height, depth);
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.position.set(0, height / 2, 0);
      coreMesh.castShadow = true;
      coreMesh.receiveShadow = true;
      bGroup.add(coreMesh);

      // Collider for player & zombies
      const box = new THREE.Box3();
      box.setFromCenterAndSize(new THREE.Vector3(x, height / 2, z), new THREE.Vector3(width, height, depth));
      colliderBoxes.push(box);

      // 2. Ground Floor Storefront (facing the street)
      if (hasStorefront) {
        const sfMat = new THREE.MeshStandardMaterial({
          map: storefrontTex,
          roughness: 0.6,
          metalness: 0.2,
        });
        const sfGeo = new THREE.BoxGeometry(0.15, 4.2, depth * 0.85);
        const sfMesh = new THREE.Mesh(sfGeo, sfMat);
        sfMesh.position.set(frontFaceX + (isLeftSide ? 0.08 : -0.08), 2.2, 0);
        bGroup.add(sfMesh);

        // Storefront Canopy / Awning
        const awningGeo = new THREE.BoxGeometry(1.6, 0.25, depth * 0.8);
        const awningMat = new THREE.MeshStandardMaterial({
          color: style === 'BRICK' ? 0x831843 : 0x1e3a5f,
          roughness: 0.6,
        });
        const awning = new THREE.Mesh(awningGeo, awningMat);
        awning.position.set(frontFaceX + (isLeftSide ? 0.85 : -0.85), 4.35, 0);
        awning.rotation.z = isLeftSide ? -0.12 : 0.12;
        awning.castShadow = true;
        bGroup.add(awning);
      }

      // 3. Multi-Floor Architectural Cornices & Dividers
      for (let floorY = 4.8; floorY < height; floorY += 4.5) {
        const corniceGeo = new THREE.BoxGeometry(0.5, 0.35, depth + 0.4);
        const cornice = new THREE.Mesh(corniceGeo, darkTrimMat);
        cornice.position.set(frontFaceX + (isLeftSide ? 0.25 : -0.25), floorY, 0);
        bGroup.add(cornice);
      }

      // Roof Parapet / Railing
      const roofParapetGeo = new THREE.BoxGeometry(width + 0.4, 1.2, depth + 0.4);
      const roofParapet = new THREE.Mesh(roofParapetGeo, darkTrimMat);
      roofParapet.position.set(0, height + 0.6, 0);
      bGroup.add(roofParapet);

      // 4. 3D Recessed Windows with Window Atlas & Glowing Glass
      const winGeo = new THREE.BoxGeometry(1.5, 2.2, 0.2);
      const winLedgeGeo = new THREE.BoxGeometry(1.7, 0.18, 0.4);
      const winLedgeMat = new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.8 });
      const winFrameMat = new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.5 });
      const glassGeo = new THREE.BoxGeometry(1.2, 1.8, 0.08);

      // HDR emissive glass (values > 1.0) so the bloom pass makes lit rooms glow
      const litAmberGlassMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.4, 1.1) });
      const litBlueGlassMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 1.9, 3.4) });
      const darkGlassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });

      for (let wy = 6.5; wy < height - 2; wy += 4.2) {
        for (let wz = -depth / 2 + 3.5; wz < depth / 2 - 2; wz += 4.8) {
          // Window Frame
          const winMesh = new THREE.Mesh(winGeo, winFrameMat);
          winMesh.position.set(frontFaceX + (isLeftSide ? 0.05 : -0.05), wy, wz);
          winMesh.rotateY(Math.PI / 2);
          bGroup.add(winMesh);

          // Stone Ledge beneath window
          const ledge = new THREE.Mesh(winLedgeGeo, winLedgeMat);
          ledge.position.set(frontFaceX + (isLeftSide ? 0.15 : -0.15), wy - 1.15, wz);
          ledge.rotateY(Math.PI / 2);
          bGroup.add(ledge);

          // Window Glass Pane (Some lit from inside!)
          const randVal = Math.random();
          const selectedGlassMat = randVal > 0.65 ? (randVal > 0.82 ? litAmberGlassMat : litBlueGlassMat) : darkGlassMat;
          const glass = new THREE.Mesh(glassGeo, selectedGlassMat);
          glass.position.set(frontFaceX + (isLeftSide ? 0.08 : -0.08), wy, wz);
          glass.rotateY(Math.PI / 2);
          bGroup.add(glass);
        }
      }

      // 5. Fire Escape Metal Stairs
      if (hasFireEscape) {
        const feGroup = new THREE.Group();
        const feX = frontFaceX + (isLeftSide ? 1.0 : -1.0);
        const feZ = depth * 0.25;

        // Lower step ladder for player access from street or dumpster
        const baseLadder = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 0.7), steelMat);
        baseLadder.position.set(feX + (isLeftSide ? 0.6 : -0.6), 1.6, feZ - 0.6);
        feGroup.add(baseLadder);

        for (let fy = 3.2; fy < height - 2; fy += 4.2) {
          // Metal Landing Platform
          const platGeo = new THREE.BoxGeometry(1.8, 0.18, 2.6);
          const plat = new THREE.Mesh(platGeo, steelMat);
          plat.position.set(feX, fy, feZ);
          feGroup.add(plat);

          // Platform Collider for jumping onto fire escapes
          const feBox = new THREE.Box3();
          feBox.setFromCenterAndSize(
            new THREE.Vector3(x + feX, fy, z + feZ),
            new THREE.Vector3(1.8, 0.25, 2.6)
          );
          colliderBoxes.push(feBox);

          // Platform Railing
          const railGeo = new THREE.BoxGeometry(1.6, 1.0, 0.08);
          const rail = new THREE.Mesh(railGeo, steelMat);
          rail.position.set(feX, fy + 0.5, feZ + 1.2);
          feGroup.add(rail);

          // Connecting Ladder
          const ladderGeo = new THREE.BoxGeometry(0.08, 4.4, 0.6);
          const ladder = new THREE.Mesh(ladderGeo, steelMat);
          ladder.position.set(feX + (isLeftSide ? 0.6 : -0.6), fy - 2.2, feZ - 0.6);
          feGroup.add(ladder);
        }
        bGroup.add(feGroup);
      }

      // 6. Rooftop Industrial Details
      // HVAC Unit
      const hvacGeo = new THREE.BoxGeometry(2.4, 1.6, 2.8);
      const hvacMat = new THREE.MeshStandardMaterial({ map: rustTex, roughness: 0.6, metalness: 0.5 });
      const hvac = new THREE.Mesh(hvacGeo, hvacMat);
      hvac.position.set((Math.random() - 0.5) * 3, height + 0.9, (Math.random() - 0.5) * (depth * 0.4));
      bGroup.add(hvac);

      // Rooftop Water Tower
      if (hasWaterTower) {
        const wtGroup = new THREE.Group();
        wtGroup.position.set(0, height + 1.2, 0);

        // Steel truss legs
        const legGeo = new THREE.CylinderGeometry(0.12, 0.12, 4.5, 6);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2d34, metalness: 0.8 });
        const legOffsets = [
          [-1.4, -1.4],
          [1.4, -1.4],
          [-1.4, 1.4],
          [1.4, 1.4],
        ];
        legOffsets.forEach(([lx, lz]) => {
          const leg = new THREE.Mesh(legGeo, legMat);
          leg.position.set(lx, 2.2, lz);
          wtGroup.add(leg);
        });

        // Wooden Cylindrical Tank
        const tankGeo = new THREE.CylinderGeometry(1.9, 1.9, 3.2, 16);
        const tankMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8 });
        const tank = new THREE.Mesh(tankGeo, tankMat);
        tank.position.set(0, 5.8, 0);
        wtGroup.add(tank);

        // Conical Roof
        const coneGeo = new THREE.ConeGeometry(2.1, 1.2, 16);
        const coneMat = new THREE.MeshStandardMaterial({ color: 0x3b3d44, roughness: 0.6 });
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.set(0, 7.8, 0);
        wtGroup.add(cone);

        bGroup.add(wtGroup);
      }

      // Communication / Antenna Mast with blinking red beacon
      const antennaGeo = new THREE.CylinderGeometry(0.06, 0.08, 6, 6);
      const antennaMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8 });
      const antenna = new THREE.Mesh(antennaGeo, antennaMat);
      antenna.position.set(frontFaceX * 0.4, height + 3.2, -depth * 0.2);
      bGroup.add(antenna);

      const beaconGeo = new THREE.SphereGeometry(0.15, 8, 8);
      const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.0, 0.35, 0.35) });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(frontFaceX * 0.4, height + 6.2, -depth * 0.2);
      bGroup.add(beacon);

      root.add(bGroup);
    };

    // --- LEFT SIDE CITY BUILDINGS ---
    // Building 0: Far South-West Armored Depot
    createDetailedBuilding(-20.5, -68, 14, 22, 32, 'CONCRETE', true, false, false);

    // Building 1: South-West Brick Tenement
    createDetailedBuilding(-19.5, -32, 13, 20, 28, 'BRICK', true, true, true);

    // Building 2: Central Quarantine Medical Clinic
    createDetailedBuilding(-20.5, 4, 15, 26, 36, 'CONCRETE', true, true, false);

    // Building 3: North-West Commercial Building (Near extraction)
    createDetailedBuilding(-19.5, 46, 13, 22, 38, 'OFFICE', true, false, true);

    // Flank Left Outer Annex
    createDetailedBuilding(-38.0, -14, 14, 18, 44, 'BRICK', false, false, false);

    // --- RIGHT SIDE CITY BUILDINGS ---
    // Building 0: Far South-East Supply Hub
    createDetailedBuilding(20.5, -68, 14, 24, 32, 'BRICK', true, true, false);

    // Building 4: South-East Metro Surplus & Arms
    createDetailedBuilding(19.5, -32, 13, 22, 28, 'OFFICE', true, false, false);

    // Building 5: Central East Tenement & Substation Alley
    createDetailedBuilding(20.5, 4, 15, 28, 36, 'BRICK', true, true, true);

    // Building 6: North-East Quarantine Warehouse
    createDetailedBuilding(19.5, 46, 13, 24, 38, 'CONCRETE', true, true, false);

    // Flank Right Outer Annex
    createDetailedBuilding(38.0, -14, 14, 18, 44, 'OFFICE', false, false, false);

    // --- SOUTH PERIMETER WALL / BARRICADE (Behind Player Spawn at z = -92) ---
    // Impressive industrial checkpoint wall with floodlights
    const southWallGeo = new THREE.BoxGeometry(64, 14, 10);
    const southWall = new THREE.Mesh(southWallGeo, concreteMat);
    southWall.position.set(0, 7, -92);
    southWall.castShadow = true;
    root.add(southWall);

    const southWallBox = new THREE.Box3();
    southWallBox.setFromCenterAndSize(new THREE.Vector3(0, 7, -92), new THREE.Vector3(64, 14, 10));
    colliderBoxes.push(southWallBox);

    // Checkpoint gate warning banner
    const bannerGeo = new THREE.BoxGeometry(18, 2.5, 0.2);
    const bannerMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.6 });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(0, 6.5, -86.8);
    root.add(banner);

    // Dual Searchlights on Checkpoint Wall (Emissive flood fixtures)
    [-6, 6].forEach((flX) => {
      const floodFixture = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), steelMat);
      floodFixture.position.set(flX, 10.5, -86.5);
      root.add(floodFixture);

      const floodLens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 0.1, 12),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 3.2, 4.2) })
      );
      floodLens.rotateX(Math.PI / 2);
      floodLens.position.set(flX, 10.5, -86.0);
      root.add(floodLens);
    });

    // ==========================================
    // 3. DISTANT METROPOLIS SKYLINE BACKDROP
    // ==========================================
    // Real 3D skyscrapers surrounding the perimeter in the atmospheric distance!
    const skylineMat = new THREE.MeshStandardMaterial({
      color: 0x1e2638,
      roughness: 0.7,
      metalness: 0.2,
      map: windowTex,
    });

    const backdropBuildings = [
      // Far Left
      { x: -50, z: -40, w: 22, h: 48, d: 24 },
      { x: -55, z: 5, w: 26, h: 64, d: 30 },
      { x: -52, z: 50, w: 24, h: 54, d: 26 },
      // Far Right
      { x: 50, z: -40, w: 22, h: 52, d: 24 },
      { x: 56, z: 5, w: 28, h: 70, d: 32 },
      { x: 52, z: 50, w: 24, h: 56, d: 26 },
      // North Distance (Beyond Safehouse)
      { x: -28, z: 95, w: 28, h: 62, d: 26 },
      { x: 0, z: 105, w: 34, h: 78, d: 30 },
      { x: 28, z: 95, w: 28, h: 58, d: 26 },
    ];

    backdropBuildings.forEach((b) => {
      const bGeo = new THREE.BoxGeometry(b.w, b.h, b.d);
      const bMesh = new THREE.Mesh(bGeo, skylineMat);
      bMesh.position.set(b.x, b.h / 2, b.z);
      root.add(bMesh);

      // Antenna light on top of skyline towers
      const ant = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff3333 }));
      ant.position.set(b.x, b.h + 1, b.z);
      root.add(ant);
    });

    // ==========================================
    // 4. STREET LAMPS (Warm Atmospheric Lighting)
    // ==========================================
    const lampGeo = new THREE.CylinderGeometry(0.12, 0.14, 6.2, 8);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x1e2126, metalness: 0.85, roughness: 0.3 });
    const lampBulbMat = new THREE.MeshBasicMaterial({ color: 0xffe89e });

    const lampPositions = [
      [-9.0, -32],
      [9.0, -22],
      [-9.0, -10],
      [9.0, 2],
      [-9.0, 14],
      [9.0, 26],
      [-9.0, 38],
      [9.0, 48],
    ];

    lampPositions.forEach(([lx, lz]) => {
      const isLeft = lx < 0;
      const pole = new THREE.Mesh(lampGeo, lampMat);
      pole.position.set(lx, 3.1, lz);
      pole.castShadow = true;
      root.add(pole);

      // Curved top arm
      const armGeo = new THREE.BoxGeometry(1.2, 0.16, 0.16);
      const arm = new THREE.Mesh(armGeo, lampMat);
      arm.position.set(lx + (isLeft ? 0.55 : -0.55), 6.1, lz);
      root.add(arm);

      // Lantern Fixture
      const headGeo = new THREE.BoxGeometry(0.45, 0.3, 0.7);
      const head = new THREE.Mesh(headGeo, lampMat);
      head.position.set(lx + (isLeft ? 1.1 : -1.1), 5.95, lz);
      root.add(head);

      // Glowing Glass Bulb (Emissive mesh, highly visible and zero light uniform cost)
      const bulbMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 8),
        lampBulbMat
      );
      bulbMesh.position.set(lx + (isLeft ? 1.1 : -1.1), 5.75, lz);
      root.add(bulbMesh);
    });

    // One central street ambient warm pointlight for the whole thoroughfare
    const streetCenterLight = new THREE.PointLight(0xffdfa4, 1.8, 45, 1.2);
    streetCenterLight.position.set(0, 7.0, 0);
    root.add(streetCenterLight);

    // ==========================================
    // 5. OVERHEAD INDUSTRIAL DUCTS & CATWALKS
    // ==========================================
    [-18, 22].forEach((pz) => {
      const ductGeo = new THREE.BoxGeometry(26, 1.2, 1.2);
      const duct = new THREE.Mesh(ductGeo, steelMat);
      duct.position.set(0, 9.2, pz);
      duct.castShadow = true;
      root.add(duct);

      const pipeGeo = new THREE.CylinderGeometry(0.22, 0.22, 26, 8);
      pipeGeo.rotateZ(Math.PI / 2);
      const pipe = new THREE.Mesh(pipeGeo, new THREE.MeshStandardMaterial({ color: 0x383b42, metalness: 0.8 }));
      pipe.position.set(0, 8.1, pz + 1.4);
      root.add(pipe);
    });

    // ==========================================
    // 6. TACTICAL BARRICADES & DEFENSIVE OBSTACLES
    // ==========================================
    const createBarricade = (x: number, z: number, rotY: number = 0) => {
      const barGroup = new THREE.Group();
      barGroup.position.set(x, 0, z);
      barGroup.rotation.y = rotY;

      // Concrete Jersey barrier
      const barGeo = new THREE.BoxGeometry(4.4, 1.2, 0.7);
      const barMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.75 });
      const barMesh = new THREE.Mesh(barGeo, barMat);
      barMesh.position.y = 0.6;
      barMesh.castShadow = true;
      barGroup.add(barMesh);

      // Warning Flasher on top
      const flasher = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.25, 8),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b })
      );
      flasher.position.set(0, 1.3, 0);
      barGroup.add(flasher);

      root.add(barGroup);

      const box = new THREE.Box3();
      box.setFromCenterAndSize(new THREE.Vector3(x, 0.6, z), new THREE.Vector3(4.4, 1.2, 0.9));
      colliderBoxes.push(box);
    };

    createBarricade(-4.5, -16, 0.12);
    createBarricade(4.8, -2, -0.18);
    createBarricade(-3.6, 18, 0.14);
    createBarricade(4.2, 33, -0.1);

    // ==========================================
    // 6B. CLIMBABLE ALLEY DUMPSTERS & PALLET STEPS
    // ==========================================
    const dumpsterMat = new THREE.MeshStandardMaterial({
      color: 0x1f3d2b, // Forest green industrial dumpster
      roughness: 0.65,
      metalness: 0.35,
    });
    const dumpsterLidMat = new THREE.MeshStandardMaterial({
      color: 0x111215, // Dark plastic lid
      roughness: 0.8,
    });

    const createDumpster = (x: number, z: number, rotY: number = 0) => {
      const dGroup = new THREE.Group();
      dGroup.position.set(x, 0, z);
      dGroup.rotation.y = rotY;

      // Main steel bin
      const binGeo = new THREE.BoxGeometry(2.4, 1.25, 1.4);
      const bin = new THREE.Mesh(binGeo, dumpsterMat);
      bin.position.y = 0.68;
      bin.castShadow = true;
      dGroup.add(bin);

      // Angled lid
      const lidGeo = new THREE.BoxGeometry(2.44, 0.12, 1.44);
      const lid = new THREE.Mesh(lidGeo, dumpsterLidMat);
      lid.position.y = 1.35;
      dGroup.add(lid);

      root.add(dGroup);

      // Box collider (enables player to jump on top of dumpster at Y = 1.35)
      const box = new THREE.Box3();
      box.setFromCenterAndSize(new THREE.Vector3(x, 0.7, z), new THREE.Vector3(2.5, 1.4, 1.5));
      colliderBoxes.push(box);
    };

    // Alleys & street side dumpsters
    createDumpster(-14.8, -16, 0.1);
    createDumpster(-15.2, 24.5, -0.15);
    createDumpster(14.8, -16, -0.08);
    createDumpster(15.2, 24.5, 0.12);
    createDumpster(-8.2, 8.0, 0.35);

    // Stacked Wooden Pallet Steps (Height 0.55m, allows step up to dumpster)
    const createPalletStack = (x: number, z: number) => {
      const pGeo = new THREE.BoxGeometry(1.4, 0.55, 1.4);
      const pMesh = new THREE.Mesh(pGeo, new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.85 }));
      pMesh.position.set(x, 0.28, z);
      pMesh.castShadow = true;
      root.add(pMesh);

      const pBox = new THREE.Box3();
      pBox.setFromCenterAndSize(new THREE.Vector3(x, 0.28, z), new THREE.Vector3(1.4, 0.55, 1.4));
      colliderBoxes.push(pBox);
    };

    createPalletStack(-13.2, -16);
    createPalletStack(13.2, -16);
    createPalletStack(-13.5, 24.5);
    createPalletStack(13.5, 24.5);

    // ==========================================
    // 7. ABANDONED QUARANTINE VEHICLES
    // ==========================================
    const createVehicle = (x: number, z: number, rotY: number, isCruiser: boolean = true) => {
      const carGroup = new THREE.Group();
      carGroup.position.set(x, 0, z);
      carGroup.rotation.y = rotY;

      // Chassis Body
      const bodyGeo = new THREE.BoxGeometry(2.3, 0.95, 4.6);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: isCruiser ? 0x1e293b : 0x334155,
        metalness: 0.6,
        roughness: 0.4,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.75;
      body.castShadow = true;
      carGroup.add(body);

      // Cabin / Roof
      const roofGeo = new THREE.BoxGeometry(1.9, 0.7, 2.6);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
      const roofMesh = new THREE.Mesh(roofGeo, roofMat);
      roofMesh.position.set(0, 1.5, -0.2);
      carGroup.add(roofMesh);

      // Lightbar on Cruiser
      if (isCruiser) {
        const barGeo = new THREE.BoxGeometry(1.2, 0.12, 0.28);
        const barMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 });
        const lightbar = new THREE.Mesh(barGeo, barMat);
        lightbar.position.set(0, 1.95, -0.2);
        carGroup.add(lightbar);

        // Emergency flashing red and blue light pods
        const redBeacon = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, 0.14, 0.24),
          new THREE.MeshBasicMaterial({ color: 0xef4444 })
        );
        redBeacon.position.set(-0.35, 2.05, -0.2);
        carGroup.add(redBeacon);

        const blueBeacon = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, 0.14, 0.24),
          new THREE.MeshBasicMaterial({ color: 0x3b82f6 })
        );
        blueBeacon.position.set(0.35, 2.05, -0.2);
        carGroup.add(blueBeacon);
      }

      // Wheels
      const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.35, 12);
      wheelGeo.rotateZ(Math.PI / 2);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
      const wheelPositions = [
        [-1.15, 0.38, 1.4],
        [1.15, 0.38, 1.4],
        [-1.15, 0.38, -1.4],
        [1.15, 0.38, -1.4],
      ];
      wheelPositions.forEach(([wx, wy, wz]) => {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.position.set(wx, wy, wz);
        carGroup.add(w);
      });

      // Vehicle Headlights
      const hlGeo = new THREE.SphereGeometry(0.14, 8, 8);
      const hlMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb });
      [-0.7, 0.7].forEach((hx) => {
        const hl = new THREE.Mesh(hlGeo, hlMat);
        hl.position.set(hx, 0.75, 2.32);
        carGroup.add(hl);
      });

      root.add(carGroup);

      const box = new THREE.Box3();
      box.setFromCenterAndSize(new THREE.Vector3(x, 1.0, z), new THREE.Vector3(2.5, 2.0, 4.8));
      colliderBoxes.push(box);
    };

    createVehicle(-6.2, -7, 0.38, true);
    createVehicle(5.8, 20, -0.25, false);

    // ==========================================
    // 8. EXPLOSIVE FUEL BARRELS (Shootable Red Barrels)
    // ==========================================
    const barrelGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.1, 14);
    const redBarrelMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.45,
      metalness: 0.3,
    });

    const spawnExplosiveBarrel = (x: number, z: number) => {
      const barrel = new THREE.Mesh(barrelGeo, redBarrelMat);
      barrel.position.set(x, 0.55, z);
      barrel.castShadow = true;
      barrel.userData = { isExplosiveBarrel: true };

      // Warning hazard collar
      const ringGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.22, 14);
      const ringMat = new THREE.MeshStandardMaterial({ map: hazardTex });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.1;
      barrel.add(ring);

      root.add(barrel);

      explosiveBarrels.push({
        mesh: barrel,
        position: new THREE.Vector3(x, 0.55, z),
        hp: 30,
        exploded: false,
      });

      const box = new THREE.Box3();
      box.setFromCenterAndSize(new THREE.Vector3(x, 0.55, z), new THREE.Vector3(0.9, 1.2, 0.9));
      colliderBoxes.push(box);
    };

    spawnExplosiveBarrel(-7.2, 3);
    spawnExplosiveBarrel(6.2, -4);
    spawnExplosiveBarrel(-5.2, 26);
    spawnExplosiveBarrel(7.0, 31);

    // ==========================================
    // 9. SUBSTATION POWER GENERATOR (Mission 2 Objective)
    // ==========================================
    // Placed in an open, fully accessible electrical substation bay at (9.0, 0, 6.0)
    const genGroup = new THREE.Group();
    genGroup.position.set(9.0, 0, 6.0);

    // Concrete Equipment Pad
    const padGeo = new THREE.BoxGeometry(4.2, 0.25, 4.2);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.9 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.y = 0.12;
    pad.receiveShadow = true;
    genGroup.add(pad);

    // Main Diesel Generator Engine Block (Yellow industrial housing)
    const genGeo = new THREE.BoxGeometry(2.4, 1.8, 1.6);
    const genMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      map: hazardTex,
      roughness: 0.5,
      metalness: 0.4,
    });
    const genMesh = new THREE.Mesh(genGeo, genMat);
    genMesh.position.y = 1.02;
    genMesh.castShadow = true;
    genGroup.add(genMesh);

    // Radiator Fan Exhaust Grill
    const grillGeo = new THREE.BoxGeometry(0.1, 1.2, 1.2);
    const grillMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });
    const grill = new THREE.Mesh(grillGeo, grillMat);
    grill.position.set(1.22, 1.1, 0);
    genGroup.add(grill);

    // Control Panel Box with interactive dials & levers
    const panelGeo = new THREE.BoxGeometry(0.2, 0.9, 0.7);
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.4, metalness: 0.7 });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(-1.22, 1.15, 0);
    genGroup.add(panel);

    // Blinking green/red breaker status LEDs
    const greenLed = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    greenLed.position.set(-1.34, 1.35, 0.15);
    const redLed = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    redLed.position.set(-1.34, 1.35, -0.15);
    genGroup.add(greenLed, redLed);

    // High Mast Warning Siren & Rotating Beacon
    const mastGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8);
    const mast = new THREE.Mesh(mastGeo, steelMat);
    mast.position.set(0.9, 2.7, 0.6);
    genGroup.add(mast);

    const genBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    );
    genBeacon.position.set(0.9, 3.65, 0.6);
    genBeacon.name = 'generator_beacon';
    genGroup.add(genBeacon);

    // Objective Pillar of Light (Beacon shooting upward so player can see it across the street)
    const beamGeo = new THREE.CylinderGeometry(0.15, 0.45, 18, 12, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0.9, 10, 0.6);
    genGroup.add(beam);

    // Warm electrical work light
    const genLight = new THREE.PointLight(0xf59e0b, 3.0, 10);
    genLight.position.set(0.9, 3.6, 0.6);
    genGroup.add(genLight);

    root.add(genGroup);

    // Generator Collider (proper compact box matching the engine housing)
    const genBox = new THREE.Box3();
    genBox.setFromCenterAndSize(new THREE.Vector3(9.0, 1.0, 6.0), new THREE.Vector3(2.4, 1.9, 1.6));
    colliderBoxes.push(genBox);

    interactiveObjects.push({
      id: 'generator_obj',
      type: 'GENERATOR',
      mesh: genGroup,
      position: new THREE.Vector3(9.0, 0, 6.0),
      radius: 5.5,
      label: 'RESTORE POWER [E]',
      isActivated: false,
    });

    // ==========================================
    // 10. EXTRACTION SAFEHOUSE BUNKER (At z = 48)
    // ==========================================
    const safeGroup = new THREE.Group();
    safeGroup.position.set(0, 0, 48);

    // Fortified Blast Bunker Frame
    const bunkerWallGeo = new THREE.BoxGeometry(32, 10, 4);
    const bunkerWall = new THREE.Mesh(bunkerWallGeo, concreteMat);
    bunkerWall.position.set(0, 5, 2);
    bunkerWall.castShadow = true;
    safeGroup.add(bunkerWall);

    // Massive Vault Blast Door
    const doorGeo = new THREE.BoxGeometry(7.5, 6.2, 0.8);
    const door = new THREE.Mesh(doorGeo, steelMat);
    door.position.set(0, 3.1, 0.1);
    door.castShadow = true;
    safeGroup.add(door);

    // Hazard Stripes framing the blast door
    const frameGeo = new THREE.BoxGeometry(9.0, 7.2, 0.3);
    const frameMat = new THREE.MeshStandardMaterial({ map: hazardTex });
    const doorFrame = new THREE.Mesh(frameGeo, frameMat);
    doorFrame.position.set(0, 3.6, -0.2);
    safeGroup.add(doorFrame);

    // Green Extraction Landing Ring
    const ringGeo = new THREE.RingGeometry(0.3, 4.2, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const landingRing = new THREE.Mesh(ringGeo, ringMat);
    landingRing.position.set(0, 0.04, -2.5);
    safeGroup.add(landingRing);

    // Extraction Flare Light (Bright Emerald Glow)
    const flareLight = new THREE.PointLight(0x22c55e, 3.2, 18);
    flareLight.position.set(0, 2.5, -2.5);
    safeGroup.add(flareLight);

    root.add(safeGroup);

    const safeBox = new THREE.Box3();
    safeBox.setFromCenterAndSize(new THREE.Vector3(0, 5, 50), new THREE.Vector3(32, 10, 5));
    colliderBoxes.push(safeBox);

    interactiveObjects.push({
      id: 'safehouse_obj',
      type: 'SAFEHOUSE',
      mesh: safeGroup,
      position: new THREE.Vector3(0, 0, 48),
      radius: 4.5,
      label: 'EXTRACT TO SAFEHOUSE',
      isActivated: false,
    });

    // ==========================================
    // HURDLE FIELDS — scattered cover across the outer districts
    // ==========================================
    // buildOuterDistricts: when false (default), skips the far decorative
    // hurdle fields that lie outside the playable corridor. They contain
    // no spawns, interactives, barrels, or mission objectives — only visual
    // backdrop. Disabling saves ~35% of environment meshes and build time.
    const buildOuterDistricts = false;
    const districtKeepOut: { x: number; z: number; r: number }[] = [
      { x: 0, z: -78, r: 9 },  // operator insertion point
      { x: 0, z: 16, r: 7 },   // emergency generator
      { x: 0, z: 48, r: 9 },   // safehouse
    ];
    if (buildOuterDistricts) {
      createHurdleField(root, colliderBoxes, {
        minX: -92, maxX: -24, minZ: -125, maxZ: 130, keepOut: districtKeepOut, count: 22, seed: 101,
      });
      createHurdleField(root, colliderBoxes, {
        minX: 24, maxX: 92, minZ: -125, maxZ: 130, keepOut: districtKeepOut, count: 22, seed: 202,
      });
      createHurdleField(root, colliderBoxes, {
        minX: -60, maxX: 60, minZ: -138, maxZ: -95, keepOut: districtKeepOut, count: 12, seed: 303,
      });
      createHurdleField(root, colliderBoxes, {
        minX: -60, maxX: 60, minZ: 60, maxZ: 135, keepOut: districtKeepOut, count: 12, seed: 404,
      });
    }

    return {
      sceneGroup: root,
      colliderBoxes,
      interactiveObjects,
      explosiveBarrels,
      // Tightened to the playable corridor (spawn Z=-78 to safehouse Z=48)
      // with margin for the player to move sideways. The outer decorative
      // districts are not built by default (see buildOuterDistricts flag).
      bounds: { minX: -65, maxX: 65, minZ: -85, maxZ: 58 },
      safehouseZone: {
        position: new THREE.Vector3(0, 0, 48),
        radius: 4.5,
      },
      playerSpawn: new THREE.Vector3(0, 0, -78),
      spawnPoints: [
        new THREE.Vector3(-8, 0, -55),
        new THREE.Vector3(8, 0, -45),
        new THREE.Vector3(-8, 0, -18),
        new THREE.Vector3(8, 0, -14),
        new THREE.Vector3(-8, 0, -5),
        new THREE.Vector3(8, 0, 8),
        new THREE.Vector3(-9, 0, 22),
        new THREE.Vector3(9, 0, 32),
        new THREE.Vector3(0, 0, 42),
        new THREE.Vector3(-12, 0, 15),
        new THREE.Vector3(-16, 0, -35),
        new THREE.Vector3(16, 0, -35),
      ],
      narrowPathSpawns: [
        // Far South-West Alleyway between Building 0 and 1
        {
          spawn: new THREE.Vector3(-22, 0, -50),
          exitPoint: new THREE.Vector3(-9, 0, -50),
          name: 'South-West Supply Gap',
        },
        // Far South-East Alleyway between Building 0 and 4
        {
          spawn: new THREE.Vector3(22, 0, -50),
          exitPoint: new THREE.Vector3(9, 0, -50),
          name: 'South-East Trench Alley',
        },
        // SW Alleyway between Building 1 and 2
        {
          spawn: new THREE.Vector3(-22, 0, -16),
          exitPoint: new THREE.Vector3(-9, 0, -16),
          name: 'SW Alleyway',
        },
        // NW Alleyway between Building 2 and 3
        {
          spawn: new THREE.Vector3(-22, 0, 24),
          exitPoint: new THREE.Vector3(-9, 0, 24),
          name: 'NW Ruin Gap',
        },
        // SE Alleyway between Building 4 and 5
        {
          spawn: new THREE.Vector3(22, 0, -16),
          exitPoint: new THREE.Vector3(9, 0, -16),
          name: 'SE Drainage Chute',
        },
        // NE Service passage between Building 5 and 6
        {
          spawn: new THREE.Vector3(22, 0, 24),
          exitPoint: new THREE.Vector3(9, 0, 24),
          name: 'NE Fire Escape Service Corridor',
        },
        // Mid-block dumpster side passage
        {
          spawn: new THREE.Vector3(-14, 0, 4),
          exitPoint: new THREE.Vector3(-8, 0, 4),
          name: 'Mid-Block Dumpster Crevice',
        },
        // Barricade side flank path
        {
          spawn: new THREE.Vector3(14, 0, -2),
          exitPoint: new THREE.Vector3(8, 0, -2),
          name: 'Right Barricade Flank',
        },
      ],
      fogColor: 0x8cbfe8, // High-visibility daylight sky fog
      fogDensity: 0.006,
      ambientColor: 0xb2d6f2, // Bright daylight ambient light
      ambientIntensity: 1.0,
      directionalColor: 0xfff7e6, // Warm clear midday sunlight
      directionalIntensity: 2.3,
      directionalPos: [35, 65, 20],
    };
  }

  public static buildForMission(missionId: number): EnvironmentResult {
    switch (missionId) {
      case 1:
        return this.buildQuarantineDistrict();
      case 2:
        return SubstationMap.build();
      case 3:
        return FreightDepotMap.build();
      case 4:
        return CheckpointBravoMap.build();
      case 5:
        return CentralPlazaMap.build();
      case 6:
        return CheckpointBravoMap.build();
      case 7:
        return SubstationMap.build();
      case 8:
        return FreightDepotMap.build();
      case 9:
        return CentralPlazaMap.build();
      case 10:
        return AirfieldHangarMap.build();
      default:
        return this.buildQuarantineDistrict();
    }
  }
}
