import * as THREE from 'three';
import { ProceduralTextures } from '../../textures/ProceduralTextures';
import { EnvironmentResult, createHurdleField, InteractiveObject } from '../EnvironmentBuilder';

export class FreightDepotMap {
  public static build(): EnvironmentResult {
    const root = new THREE.Group();
    root.name = 'freight_depot_district';

    const colliderBoxes: THREE.Box3[] = [];
    const interactiveObjects: InteractiveObject[] = [];
    const explosiveBarrels: { mesh: THREE.Mesh; position: THREE.Vector3; hp: number; exploded: boolean }[] = [];

    // Textures
    const concreteTex = ProceduralTextures.getConcreteWall();
    concreteTex.repeat.set(4, 4);

    const blueContainerTex = ProceduralTextures.getShippingContainer('#1e3a8a');
    const redContainerTex = ProceduralTextures.getShippingContainer('#991b1b');
    const greenContainerTex = ProceduralTextures.getShippingContainer('#14532d');
    const yellowContainerTex = ProceduralTextures.getShippingContainer('#b45309');
    const hazardTex = ProceduralTextures.getHazardStripes();
    const woodTex = ProceduralTextures.getWoodPlanks();

    // Materials
    const groundMat = new THREE.MeshStandardMaterial({
      map: concreteTex,
      roughness: 0.8,
      metalness: 0.15,
      color: 0x475569,
    });

    const blueMat = new THREE.MeshStandardMaterial({ map: blueContainerTex, roughness: 0.5, metalness: 0.4 });
    const redMat = new THREE.MeshStandardMaterial({ map: redContainerTex, roughness: 0.5, metalness: 0.4 });
    const greenMat = new THREE.MeshStandardMaterial({ map: greenContainerTex, roughness: 0.5, metalness: 0.4 });
    const yellowMat = new THREE.MeshStandardMaterial({ map: yellowContainerTex, roughness: 0.5, metalness: 0.4 });

    const wallMat = new THREE.MeshStandardMaterial({
      map: concreteTex,
      roughness: 0.9,
      metalness: 0.1,
      color: 0x334155,
    });

    // 1. Asphalt / Concrete Yard Ground (expanded 170m x 230m)
    const groundGeo = new THREE.PlaneGeometry(240, 320);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.receiveShadow = true;
    root.add(groundMesh);

    // Perimeter Warehouse Walls
    const wallConfigs = [
      { x: -110, z: 0, w: 2, h: 12, d: 300 }, // West wall
      { x: 110, z: 0, w: 2, h: 12, d: 300 },  // East wall
      { x: 0, z: -148, w: 224, h: 12, d: 2 },  // North wall
      { x: 0, z: 148, w: 224, h: 12, d: 2 },   // South wall
    ];

    for (const wc of wallConfigs) {
      const geo = new THREE.BoxGeometry(wc.w, wc.h, wc.d);
      const wall = new THREE.Mesh(geo, wallMat);
      wall.position.set(wc.x, wc.h / 2, wc.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      root.add(wall);

      const box = new THREE.Box3();
      box.setFromCenterAndSize(wall.position, new THREE.Vector3(wc.w, wc.h, wc.d));
      colliderBoxes.push(box);
    }

    // 2. Shipping Containers (Maze Layout with Single & Stacked Tiers)
    const containerConfigs: {
      x: number;
      z: number;
      rotY: number;
      length: number; // 6m or 12m
      stacks: number;
      mat: THREE.MeshStandardMaterial;
    }[] = [
      // Section A: Northwest Row
      { x: -18, z: -40, rotY: 0, length: 12, stacks: 2, mat: blueMat },
      { x: -6, z: -40, rotY: 0, length: 12, stacks: 1, mat: redMat },
      { x: -18, z: -22, rotY: Math.PI / 2, length: 12, stacks: 2, mat: greenMat },
      { x: -5, z: -18, rotY: 0, length: 12, stacks: 2, mat: yellowMat },

      // Section B: Central Corridor Chokepoints
      { x: 8, z: -35, rotY: 0, length: 12, stacks: 2, mat: redMat },
      { x: 20, z: -30, rotY: Math.PI / 2, length: 12, stacks: 1, mat: blueMat },
      { x: 14, z: -12, rotY: 0, length: 12, stacks: 2, mat: greenMat },
      { x: -14, z: -2, rotY: 0, length: 12, stacks: 1, mat: yellowMat },
      { x: 0, z: 0, rotY: Math.PI / 2, length: 12, stacks: 2, mat: blueMat },

      // Section C: South Corridor
      { x: -18, z: 18, rotY: 0, length: 12, stacks: 2, mat: redMat },
      { x: -8, z: 24, rotY: Math.PI / 2, length: 12, stacks: 1, mat: blueMat },
      { x: 12, z: 16, rotY: 0, length: 12, stacks: 2, mat: yellowMat },
      { x: 22, z: 24, rotY: Math.PI / 2, length: 12, stacks: 2, mat: greenMat },
      { x: 0, z: 36, rotY: 0, length: 12, stacks: 1, mat: redMat },
      { x: -16, z: 42, rotY: Math.PI / 2, length: 12, stacks: 2, mat: blueMat },
    ];

    for (const cc of containerConfigs) {
      const width = 2.8;
      const height = 2.9;
      const length = cc.length;

      for (let s = 0; s < cc.stacks; s++) {
        const geo = new THREE.BoxGeometry(width, height, length);
        const mesh = new THREE.Mesh(geo, cc.mat);
        mesh.position.set(cc.x, height / 2 + s * height, cc.z);
        mesh.rotation.y = cc.rotY;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        root.add(mesh);
      }

      // Add single unified collider for stack
      const totalH = height * cc.stacks;
      const sizeX = cc.rotY === 0 ? width : length;
      const sizeZ = cc.rotY === 0 ? length : width;
      const box = new THREE.Box3();
      box.setFromCenterAndSize(
        new THREE.Vector3(cc.x, totalH / 2, cc.z),
        new THREE.Vector3(sizeX, totalH, sizeZ)
      );
      colliderBoxes.push(box);
    }

    // 3. Wooden Cargo Pallet Stacks & Forklift Crates
    const palletGeo = new THREE.BoxGeometry(2.2, 1.8, 2.2);
    const palletMat = new THREE.MeshStandardMaterial({
      map: woodTex,
      roughness: 0.85,
      metalness: 0.05,
    });

    const crateLocations = [
      { x: -8, z: -30 },
      { x: 4, z: -20 },
      { x: -22, z: 5 },
      { x: 2, z: 18 },
      { x: 18, z: 2 },
      { x: 8, z: 40 },
    ];

    for (const cl of crateLocations) {
      const crate = new THREE.Mesh(palletGeo, palletMat);
      crate.position.set(cl.x, 0.9, cl.z);
      crate.castShadow = true;
      crate.receiveShadow = true;
      root.add(crate);

      const box = new THREE.Box3();
      box.setFromCenterAndSize(crate.position, new THREE.Vector3(2.3, 1.9, 2.3));
      colliderBoxes.push(box);
    }

    // 4. Bio-hazard Quarantine Decontamination Tent at [-2, 0, -10]
    const tentGroup = new THREE.Group();
    tentGroup.position.set(-2, 0, -10);

    const tentMat = new THREE.MeshStandardMaterial({
      color: 0xeab308, // biohazard yellow vinyl
      roughness: 0.4,
      metalness: 0.1,
    });
    const tentGeo = new THREE.BoxGeometry(7, 4.5, 7);
    const tent = new THREE.Mesh(tentGeo, tentMat);
    tent.position.y = 2.25;
    tent.castShadow = true;
    tentGroup.add(tent);

    // Hazard stripe band
    const bandGeo = new THREE.BoxGeometry(7.1, 0.6, 7.1);
    const bandMat = new THREE.MeshStandardMaterial({ map: hazardTex });
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.position.y = 1.2;
    tentGroup.add(band);

    root.add(tentGroup);

    const tentBox = new THREE.Box3();
    tentBox.setFromCenterAndSize(new THREE.Vector3(-2, 2.25, -10), new THREE.Vector3(7.2, 4.5, 7.2));
    colliderBoxes.push(tentBox);

    // 5. Overhead Depot Sodium Floodlight Towers
    for (const lz of [-45, 10, 50]) {
      const towerGeo = new THREE.CylinderGeometry(0.3, 0.4, 14, 8);
      const towerMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
      const tower = new THREE.Mesh(towerGeo, towerMat);
      tower.position.set(-26, 7, lz);
      root.add(tower);

      const sodiumLight = new THREE.PointLight(0xfef08a, 2.8, 22);
      sodiumLight.position.set(-26, 14.2, lz);
      root.add(sodiumLight);
    }

    // 6. Extraction Security Gate at [22, 0, 39] with LZ Beacon at [22, 0, 31]
    const gateGroup = new THREE.Group();
    gateGroup.position.set(22, 0, 39);

    const bunkerGeo = new THREE.BoxGeometry(8, 6, 4);
    const bunker = new THREE.Mesh(bunkerGeo, wallMat);
    bunker.position.y = 3;
    gateGroup.add(bunker);

    const blastDoor = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 4.2, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 })
    );
    blastDoor.position.set(0, 2.1, -2.1);
    gateGroup.add(blastDoor);

    // Green Extraction Landing Ring at world position [22, 0, 31] (offset -8.0 from 39)
    const ringGeo = new THREE.RingGeometry(0.5, 4.8, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(0, 0.04, -8.0);
    gateGroup.add(ring);

    // Flashing Green Extraction Beacons around LZ
    [-3.8, 3.8].forEach((bx) => {
      const beaconPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 2.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 })
      );
      beaconPole.position.set(bx, 1.1, -8.0);
      gateGroup.add(beaconPole);

      const beaconLight = new THREE.PointLight(0x22c55e, 3.5, 14);
      beaconLight.position.set(bx, 2.3, -8.0);
      gateGroup.add(beaconLight);
    });

    const gateLight = new THREE.PointLight(0x22c55e, 4.0, 18);
    gateLight.position.set(0, 3.0, -8.0);
    gateGroup.add(gateLight);

    root.add(gateGroup);

    // Bunker collider strictly behind the extraction zone
    const gateBox = new THREE.Box3();
    gateBox.setFromCenterAndSize(new THREE.Vector3(22, 3, 39), new THREE.Vector3(8.5, 6, 4.2));
    colliderBoxes.push(gateBox);

    interactiveObjects.push({
      id: 'depot_extraction_gate',
      type: 'SAFEHOUSE',
      mesh: gateGroup,
      position: new THREE.Vector3(22, 0, 31),
      radius: 5.0,
      label: 'EXTRACT THROUGH GATE',
      isActivated: false,
    });

    // 7. Explosive Chemical Barrels
    const barrelCoords = [
      new THREE.Vector3(-10, 0, -20),
      new THREE.Vector3(10, 0, -22),
      new THREE.Vector3(-4, 0, 8),
      new THREE.Vector3(14, 0, 4),
      new THREE.Vector3(-10, 0, 28),
      new THREE.Vector3(6, 0, 30),
    ];

    const barrelGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.2, 10);
    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      metalness: 0.7,
      roughness: 0.35,
    });

    for (const bPos of barrelCoords) {
      const barrel = new THREE.Mesh(barrelGeo, barrelMat.clone());
      barrel.position.copy(bPos);
      barrel.position.y = 0.6;
      barrel.castShadow = true;
      root.add(barrel);

      explosiveBarrels.push({
        mesh: barrel,
        position: bPos.clone(),
        hp: 40,
        exploded: false,
      });

      const bbox = new THREE.Box3();
      bbox.setFromCenterAndSize(barrel.position, new THREE.Vector3(1.0, 1.4, 1.0));
      colliderBoxes.push(bbox);
    }


    // ==========================================
    // HURDLE FIELDS — scattered cover across the expanded arena
    // ==========================================
    const keepOut = [{"x":-18,"z":8,"r":7},{"x":14,"z":12,"r":7},{"x":22,"z":31,"r":8},{"x":-2,"z":-10,"r":8},{"x":-24,"z":-35,"r":9}];
    createHurdleField(root, colliderBoxes, { minX: -92, maxX: -26, minZ: -128, maxZ: 132, keepOut, count: 18, seed: 601 });
    createHurdleField(root, colliderBoxes, { minX: 26, maxX: 92, minZ: -128, maxZ: 132, keepOut, count: 18, seed: 602 });
    createHurdleField(root, colliderBoxes, { minX: -55, maxX: 55, minZ: -138, maxZ: -92, keepOut, count: 10, seed: 603 });
    createHurdleField(root, colliderBoxes, { minX: -55, maxX: 55, minZ: 62, maxZ: 136, keepOut, count: 10, seed: 604 });

    return {
      sceneGroup: root,
      colliderBoxes,
      interactiveObjects,
      explosiveBarrels,
      bounds: { minX: -105, maxX: 105, minZ: -143, maxZ: 143 },
      safehouseZone: {
        position: new THREE.Vector3(22, 0, 31),
        radius: 5.0,
      },
      playerSpawn: new THREE.Vector3(-24, 0, -35),
      spawnPoints: [
        new THREE.Vector3(-18, 0, -15),
        new THREE.Vector3(-6, 0, -22),
        new THREE.Vector3(10, 0, -12),
        new THREE.Vector3(-18, 0, 8),
        new THREE.Vector3(6, 0, 14),
        new THREE.Vector3(18, 0, 22),
        new THREE.Vector3(-8, 0, 28),
      ],
      narrowPathSpawns: [
        // Container labyrinth aisle West
        {
          spawn: new THREE.Vector3(-22, 0, -28),
          exitPoint: new THREE.Vector3(-10, 0, -28),
          name: 'Container Aisle 1',
        },
        // Container labyrinth aisle East
        {
          spawn: new THREE.Vector3(22, 0, -18),
          exitPoint: new THREE.Vector3(8, 0, -18),
          name: 'Container Aisle 2',
        },
        // Narrow crane service passage
        {
          spawn: new THREE.Vector3(-20, 0, 20),
          exitPoint: new THREE.Vector3(-8, 0, 20),
          name: 'Crane Service Chute',
        },
        // Loading dock narrow ramp
        {
          spawn: new THREE.Vector3(20, 0, 8),
          exitPoint: new THREE.Vector3(8, 0, 8),
          name: 'Loading Dock Ramp',
        },
      ],
      fogColor: 0x0c1a10, // Eerie toxic green biohazard fog
      fogDensity: 0.028,
      ambientColor: 0x164e2f,
      ambientIntensity: 0.75,
      directionalColor: 0x86efac,
      directionalIntensity: 1.6,
      directionalPos: [20, 50, 20],
    };
  }
}
