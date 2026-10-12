import * as THREE from 'three';
import { ProceduralTextures } from '../../textures/ProceduralTextures';
import { EnvironmentResult, createHurdleField, InteractiveObject } from '../EnvironmentBuilder';

export class SubstationMap {
  public static build(): EnvironmentResult {
    const root = new THREE.Group();
    root.name = 'substation_grid_district';

    const colliderBoxes: THREE.Box3[] = [];
    const interactiveObjects: InteractiveObject[] = [];
    const explosiveBarrels: { mesh: THREE.Mesh; position: THREE.Vector3; hp: number; exploded: boolean }[] = [];

    // Textures
    const concreteTex = ProceduralTextures.getConcreteWall();
    concreteTex.repeat.set(4, 3);

    const rustTex = ProceduralTextures.getRustedMetal();
    const hazardTex = ProceduralTextures.getHazardStripes();
    const metalTex = ProceduralTextures.getIndustrialTransformer();

    // Materials
    const groundMat = new THREE.MeshStandardMaterial({
      map: concreteTex,
      roughness: 0.7,
      metalness: 0.2,
      color: 0x52525b,
    });

    const wallMat = new THREE.MeshStandardMaterial({
      map: concreteTex,
      roughness: 0.85,
      metalness: 0.1,
      color: 0x3f3f46,
    });

    const steelMat = new THREE.MeshStandardMaterial({
      map: rustTex,
      roughness: 0.45,
      metalness: 0.8,
      color: 0x71717a,
    });

    const hazardMat = new THREE.MeshStandardMaterial({
      map: hazardTex,
      roughness: 0.5,
      metalness: 0.2,
    });

    const darkTrimMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.6,
      metalness: 0.4,
    });

    // 1. Concrete Substation Ground (expanded 170m x 230m)
    const groundGeo = new THREE.PlaneGeometry(240, 320);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.set(0, 0, 0);
    groundMesh.receiveShadow = true;
    root.add(groundMesh);

    // Perimeter Blast Walls
    const wallConfigs = [
      { x: -110, z: 0, w: 2, h: 10, d: 300 }, // West wall
      { x: 110, z: 0, w: 2, h: 10, d: 300 },  // East wall
      { x: 0, z: -148, w: 224, h: 10, d: 2 },  // North wall
      { x: 0, z: 148, w: 224, h: 10, d: 2 },   // South wall
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

    // 2. High Voltage Transformer Units (Cylinders & Radiator Cooling Arrays)
    const transformerPositions = [
      { x: -14, z: -18 },
      { x: -14, z: 2 },
      { x: -14, z: 22 },
      { x: 18, z: -20 },
      { x: 18, z: -2 },
      { x: 18, z: 24 },
    ];

    for (const tp of transformerPositions) {
      const unit = new THREE.Group();
      unit.position.set(tp.x, 0, tp.z);

      // Main heavy transformer tank
      const tankGeo = new THREE.BoxGeometry(5.0, 4.2, 5.0);
      const tank = new THREE.Mesh(tankGeo, steelMat);
      tank.position.y = 2.1;
      tank.castShadow = true;
      tank.receiveShadow = true;
      unit.add(tank);

      // Ceramic bushing insulators on top
      for (let bx = -1.6; bx <= 1.6; bx += 1.6) {
        for (let bz = -1.2; bz <= 1.2; bz += 2.4) {
          const bushGeo = new THREE.CylinderGeometry(0.2, 0.28, 1.4, 8);
          const bushMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.2 });
          const bush = new THREE.Mesh(bushGeo, bushMat);
          bush.position.set(bx, 4.8, bz);
          unit.add(bush);
        }
      }

      // Cooling radiator fins
      for (let side = -1; side <= 1; side += 2) {
        const finGeo = new THREE.BoxGeometry(0.3, 3.4, 4.4);
        const fin = new THREE.Mesh(finGeo, darkTrimMat);
        fin.position.set(side * 2.65, 2.0, 0);
        unit.add(fin);
      }

      // Hazard caution stripe band
      const hazGeo = new THREE.BoxGeometry(5.1, 0.6, 5.1);
      const hazMesh = new THREE.Mesh(hazGeo, hazardMat);
      hazMesh.position.y = 1.0;
      unit.add(hazMesh);

      root.add(unit);

      const box = new THREE.Box3();
      box.setFromCenterAndSize(new THREE.Vector3(tp.x, 2.5, tp.z), new THREE.Vector3(5.6, 5.0, 5.6));
      colliderBoxes.push(box);
    }

    // Overhead Cable Gantry Pylons spanning the yard
    const pylonGeo = new THREE.BoxGeometry(1.2, 12, 1.2);
    const crossGeo = new THREE.BoxGeometry(28, 0.8, 0.8);
    for (const pz of [-25, 10, 40]) {
      const p1 = new THREE.Mesh(pylonGeo, steelMat);
      p1.position.set(-14, 6, pz);
      root.add(p1);

      const p2 = new THREE.Mesh(pylonGeo, steelMat);
      p2.position.set(14, 6, pz);
      root.add(p2);

      const cross = new THREE.Mesh(crossGeo, steelMat);
      cross.position.set(0, 11.5, pz);
      root.add(cross);

      // Warning strobe at top
      const strobeLight = new THREE.PointLight(0x38bdf8, 1.5, 15);
      strobeLight.position.set(0, 12.2, pz);
      root.add(strobeLight);
    }

    // 3. Central Diesel Generator Station (Mission 2 Primary Objective at [12, 0, 8])
    const genGroup = new THREE.Group();
    genGroup.position.set(12, 0, 8);

    // Generator housing
    const genBodyGeo = new THREE.BoxGeometry(6.5, 3.8, 4.2);
    const genBody = new THREE.Mesh(genBodyGeo, hazardMat);
    genBody.position.y = 1.9;
    genBody.castShadow = true;
    genGroup.add(genBody);

    // Exhaust chimneys
    const pipeGeo = new THREE.CylinderGeometry(0.3, 0.3, 2.2, 8);
    const pMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.5 });
    const pipe1 = new THREE.Mesh(pipeGeo, pMat);
    pipe1.position.set(-1.8, 4.5, 0.8);
    genGroup.add(pipe1);

    const pipe2 = new THREE.Mesh(pipeGeo, pMat);
    pipe2.position.set(-0.6, 4.5, 0.8);
    genGroup.add(pipe2);

    // Amber Rotating Warning Beacon
    const beaconGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.5, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.position.set(2.0, 4.1, 0);
    genGroup.add(beaconMesh);

    const genLight = new THREE.PointLight(0xf59e0b, 3.5, 14);
    genLight.position.set(2.0, 4.5, 0);
    genGroup.add(genLight);

    root.add(genGroup);

    const genBox = new THREE.Box3();
    genBox.setFromCenterAndSize(new THREE.Vector3(12, 2, 8), new THREE.Vector3(7.0, 4.2, 4.8));
    colliderBoxes.push(genBox);

    interactiveObjects.push({
      id: 'substation_generator',
      type: 'GENERATOR',
      mesh: genGroup,
      position: new THREE.Vector3(12, 0, 8),
      radius: 5.5,
      label: 'RESTORE GENERATOR POWER',
      isActivated: false,
    });

    // 4. Substation Control Safehouse / Emergency Extraction Bunker at [-14, 0, 36]
    const bunkerGroup = new THREE.Group();
    bunkerGroup.position.set(-14, 0, 36);

    const bunkerGeo = new THREE.BoxGeometry(10, 6, 8);
    const bunker = new THREE.Mesh(bunkerGeo, wallMat);
    bunker.position.y = 3;
    bunkerGroup.add(bunker);

    // Blast Door
    const bDoorGeo = new THREE.BoxGeometry(4.5, 4.2, 0.4);
    const bDoor = new THREE.Mesh(bDoorGeo, steelMat);
    bDoor.position.set(0, 2.1, -4.1);
    bunkerGroup.add(bDoor);

    // Green landing extraction beacon
    const ringGeo = new THREE.RingGeometry(0.4, 4.2, 28);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(0, 0.04, -6.0);
    bunkerGroup.add(ring);

    const bunkerLight = new THREE.PointLight(0x22c55e, 3.0, 16);
    bunkerLight.position.set(0, 3.0, -6.0);
    bunkerGroup.add(bunkerLight);

    root.add(bunkerGroup);

    const bunkerBox = new THREE.Box3();
    bunkerBox.setFromCenterAndSize(new THREE.Vector3(-14, 3, 36), new THREE.Vector3(10.5, 6, 8.5));
    colliderBoxes.push(bunkerBox);

    interactiveObjects.push({
      id: 'substation_safehouse',
      type: 'SAFEHOUSE',
      mesh: bunkerGroup,
      position: new THREE.Vector3(-14, 0, 36),
      radius: 4.8,
      label: 'EXTRACT TO SAFEHOUSE',
      isActivated: false,
    });

    // 5. Explosive Fuel & Chemical Barrels (Tactical hazards)
    const barrelCoords = [
      new THREE.Vector3(2, 0, -12),
      new THREE.Vector3(3.2, 0, -12),
      new THREE.Vector3(-4, 0, 14),
      new THREE.Vector3(15, 0, -12),
      new THREE.Vector3(-6, 0, -25),
      new THREE.Vector3(6, 0, 28),
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

    // Concrete barrier blocks in yard
    const barrierGeo = new THREE.BoxGeometry(4.0, 1.2, 1.0);
    for (const bz of [-8, 16]) {
      const bar = new THREE.Mesh(barrierGeo, wallMat);
      bar.position.set(0, 0.6, bz);
      bar.castShadow = true;
      root.add(bar);

      const bbox = new THREE.Box3();
      bbox.setFromCenterAndSize(bar.position, new THREE.Vector3(4.2, 1.3, 1.2));
      colliderBoxes.push(bbox);
    }


    // ==========================================
    // HURDLE FIELDS — scattered cover across the expanded arena
    // ==========================================
    const keepOut = [{"x":12,"z":8,"r":8},{"x":-14,"z":36,"r":8},{"x":0,"z":-36,"r":9}];
    createHurdleField(root, colliderBoxes, { minX: -92, maxX: -26, minZ: -128, maxZ: 132, keepOut, count: 18, seed: 501 });
    createHurdleField(root, colliderBoxes, { minX: 26, maxX: 92, minZ: -128, maxZ: 132, keepOut, count: 18, seed: 502 });
    createHurdleField(root, colliderBoxes, { minX: -55, maxX: 55, minZ: -138, maxZ: -92, keepOut, count: 10, seed: 503 });
    createHurdleField(root, colliderBoxes, { minX: -55, maxX: 55, minZ: 62, maxZ: 136, keepOut, count: 10, seed: 504 });

    return {
      sceneGroup: root,
      colliderBoxes,
      interactiveObjects,
      explosiveBarrels,
      bounds: { minX: -105, maxX: 105, minZ: -143, maxZ: 143 },
      safehouseZone: {
        position: new THREE.Vector3(-14, 0, 36),
        radius: 4.8,
      },
      playerSpawn: new THREE.Vector3(0, 0, -36),
      spawnPoints: [
        new THREE.Vector3(-12, 0, -10),
        new THREE.Vector3(4, 0, -16),
        new THREE.Vector3(14, 0, -4),
        new THREE.Vector3(-6, 0, 10),
        new THREE.Vector3(16, 0, 18),
        new THREE.Vector3(-15, 0, 24),
        new THREE.Vector3(0, 0, 30),
      ],
      narrowPathSpawns: [
        // Transformer maintenance corridor left
        {
          spawn: new THREE.Vector3(-22, 0, -6),
          exitPoint: new THREE.Vector3(-10, 0, -6),
          name: 'West Transformer Alley',
        },
        // Capacitor bank catwalk right
        {
          spawn: new THREE.Vector3(22, 0, 6),
          exitPoint: new THREE.Vector3(10, 0, 6),
          name: 'East Capacitor Gap',
        },
        // Back of generator enclosure
        {
          spawn: new THREE.Vector3(18, 0, 26),
          exitPoint: new THREE.Vector3(8, 0, 20),
          name: 'Generator Back Corridor',
        },
        // Narrow drainage culvert
        {
          spawn: new THREE.Vector3(-22, 0, 18),
          exitPoint: new THREE.Vector3(-10, 0, 18),
          name: 'Culvert Flank',
        },
      ],
      fogColor: 0x64748b, // Afternoon rain overcast sky fog
      fogDensity: 0.015,
      ambientColor: 0x94a3b8, // Daylight overcast ambient
      ambientIntensity: 0.82,
      directionalColor: 0xdbeafe, // Soft afternoon daylight through stormclouds
      directionalIntensity: 1.35,
      directionalPos: [30, 50, -10],
    };
  }
}
