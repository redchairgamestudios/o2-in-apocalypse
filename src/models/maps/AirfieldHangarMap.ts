import * as THREE from 'three';
import { ProceduralTextures } from '../../textures/ProceduralTextures';
import { EnvironmentResult, createHurdleField, InteractiveObject } from '../EnvironmentBuilder';
import { HelicopterModel } from '../HelicopterModel';

export class AirfieldHangarMap {
  public static build(): EnvironmentResult {
    const root = new THREE.Group();
    root.name = 'airfield_omega_map';

    const colliderBoxes: THREE.Box3[] = [];
    const interactiveObjects: InteractiveObject[] = [];
    const explosiveBarrels: { mesh: THREE.Mesh; position: THREE.Vector3; hp: number; exploded: boolean }[] = [];

    // Textures & Materials
    const asphaltTex = ProceduralTextures.getAsphalt();
    asphaltTex.repeat.set(10, 16);

    const metalTex = ProceduralTextures.getRustedMetal();
    const hazardTex = ProceduralTextures.getHazardStripes();
    const concreteTex = ProceduralTextures.getConcreteWall();

    const tarmacMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: 0.8,
      metalness: 0.2,
      color: 0x33373b,
    });

    const hangarWallMat = new THREE.MeshStandardMaterial({
      map: metalTex,
      roughness: 0.6,
      metalness: 0.7,
      color: 0x475569,
    });

    const concreteMat = new THREE.MeshStandardMaterial({
      map: concreteTex,
      roughness: 0.85,
      metalness: 0.1,
      color: 0x52525b,
    });

    const hazardMat = new THREE.MeshBasicMaterial({ map: hazardTex });

    // 1. Tarmac Runway & Airfield Apron (expanded 190m x 250m)
    const tarmacGeo = new THREE.PlaneGeometry(240, 320);
    tarmacGeo.rotateX(-Math.PI / 2);
    const tarmacMesh = new THREE.Mesh(tarmacGeo, tarmacMat);
    tarmacMesh.receiveShadow = true;
    root.add(tarmacMesh);

    // Perimeter Security Blast Barriers & Hangar Walls
    const perimeterWalls = [
      { x: -110, z: 0, w: 2, h: 12, d: 300 },
      { x: 110, z: 0, w: 2, h: 12, d: 300 },
      { x: 0, z: -148, w: 224, h: 12, d: 2 },
      { x: 0, z: 148, w: 224, h: 12, d: 2 },
    ];

    perimeterWalls.forEach((w) => {
      const geo = new THREE.BoxGeometry(w.w, w.h, w.d);
      const mesh = new THREE.Mesh(geo, concreteMat);
      mesh.position.set(w.x, w.h / 2, w.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);

      const b = new THREE.Box3();
      b.setFromCenterAndSize(mesh.position, new THREE.Vector3(w.w, w.h, w.d));
      colliderBoxes.push(b);
    });

    // 2. Heavy Maintenance Hangar Structure on the East side (x: 18, z: -20)
    const hangarGeo = new THREE.BoxGeometry(24, 10, 32);
    const hangarMesh = new THREE.Mesh(hangarGeo, hangarWallMat);
    hangarMesh.position.set(24, 5, -20);
    hangarMesh.castShadow = true;
    hangarMesh.receiveShadow = true;
    root.add(hangarMesh);

    const hBox = new THREE.Box3();
    hBox.setFromCenterAndSize(hangarMesh.position, new THREE.Vector3(24, 10, 32));
    colliderBoxes.push(hBox);

    // 3. OBJECTIVE 1: REPLACEMENT HELICOPTER ENGINE ASSEMBLY at [16, 0, -18]
    const engineStation = new THREE.Group();
    engineStation.position.set(16, 0, -18);

    // Pallet Base
    const palletGeo = new THREE.BoxGeometry(3.2, 0.35, 3.2);
    const palletMesh = new THREE.Mesh(palletGeo, concreteMat);
    palletMesh.position.y = 0.18;
    engineStation.add(palletMesh);

    // Turboshaft Engine Core Block
    const engBlockGeo = new THREE.CylinderGeometry(0.65, 0.75, 2.6, 12);
    engBlockGeo.rotateZ(Math.PI / 2);
    const engMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.3, metalness: 0.9 });
    const engMesh = new THREE.Mesh(engBlockGeo, engMat);
    engMesh.position.y = 1.0;
    engineStation.add(engMesh);

    // Yellow Crane Hoist Rig
    const hoistGeo = new THREE.BoxGeometry(0.2, 2.8, 0.2);
    const hoistMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.5 });
    [-1.2, 1.2].forEach((hx) => {
      const pole = new THREE.Mesh(hoistGeo, hoistMat);
      pole.position.set(hx, 1.4, 0);
      engineStation.add(pole);
    });
    const topBarGeo = new THREE.BoxGeometry(2.6, 0.2, 0.2);
    const topBar = new THREE.Mesh(topBarGeo, hoistMat);
    topBar.position.set(0, 2.7, 0);
    engineStation.add(topBar);

    // Pulsing Blue Indicator Light
    const engineLight = new THREE.PointLight(0x38bdf8, 4.0, 18);
    engineLight.position.set(0, 2.2, 0);
    engineStation.add(engineLight);

    root.add(engineStation);

    interactiveObjects.push({
      id: 'chopper_engine_assembly',
      type: 'CRATE',
      mesh: engineStation,
      position: new THREE.Vector3(16, 0, -18),
      radius: 4.8,
      label: 'SECURE HELICOPTER ENGINE',
      isActivated: false,
    });

    // 4. OBJECTIVE 2: PETROL FUEL STATION at [0, 0, 36] (Beside Helicopter)
    const fuelStation = new THREE.Group();
    fuelStation.position.set(0, 0, 36);

    // Fuel Pump Console
    const pumpGeo = new THREE.BoxGeometry(1.6, 2.2, 1.2);
    const pumpMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4, metalness: 0.5 });
    const pumpMesh = new THREE.Mesh(pumpGeo, pumpMat);
    pumpMesh.position.y = 1.1;
    fuelStation.add(pumpMesh);

    // Fuel Drums Cluster
    const drumGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.2, 10);
    const drumMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.5, metalness: 0.7 });
    [-1.2, 1.2].forEach((dx) => {
      const drum = new THREE.Mesh(drumGeo, drumMat);
      drum.position.set(dx, 0.6, 0);
      fuelStation.add(drum);
    });

    // Orange Fuel Beacon
    const fuelLight = new THREE.PointLight(0xf97316, 4.0, 20);
    fuelLight.position.set(0, 2.6, 0);
    fuelStation.add(fuelLight);

    root.add(fuelStation);

    interactiveObjects.push({
      id: 'chopper_petrol_refill',
      type: 'GENERATOR',
      mesh: fuelStation,
      position: new THREE.Vector3(0, 0, 36),
      radius: 5.0,
      label: 'REFILL HELICOPTER PETROL',
      isActivated: false,
    });

    // 5. OBJECTIVE 3: TIME-BOMB DETONATOR TERMINAL at [0, 0, 0] (Central Ground Zero Pylon)
    const bombStation = new THREE.Group();
    bombStation.position.set(0, 0, 0);

    // Quarantine Monument Tower
    const pylonGeo = new THREE.CylinderGeometry(1.2, 1.8, 6.0, 8);
    const pylonMesh = new THREE.Mesh(pylonGeo, concreteMat);
    pylonMesh.position.y = 3.0;
    bombStation.add(pylonMesh);

    // Thermobaric Time-Bomb Module
    const bombCoreGeo = new THREE.BoxGeometry(1.8, 1.2, 1.2);
    const bombCoreMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.2, metalness: 0.9 });
    const bombCore = new THREE.Mesh(bombCoreGeo, bombCoreMat);
    bombCore.position.set(0, 1.4, 1.2);
    bombStation.add(bombCore);

    // Digital Countdown Display Mesh
    const dispGeo = new THREE.PlaneGeometry(1.2, 0.4);
    const dispMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const dispMesh = new THREE.Mesh(dispGeo, dispMat);
    dispMesh.position.set(0, 1.55, 1.82);
    bombStation.add(dispMesh);

    // Searing Red Detonation Strobe
    const bombStrobe = new THREE.PointLight(0xef4444, 5.0, 22);
    bombStrobe.position.set(0, 2.5, 1.2);
    bombStation.add(bombStrobe);

    root.add(bombStation);

    interactiveObjects.push({
      id: 'thermobaric_time_bomb',
      type: 'GENERATOR',
      mesh: bombStation,
      position: new THREE.Vector3(0, 0, 0),
      radius: 5.5,
      label: 'DEPLOY THERMOBARIC TIME-BOMB',
      isActivated: false,
    });

    // 6. OBJECTIVE 4: HELIPAD & EXTRACTION HELICOPTER at [0, 0, 44]
    const helipad = new THREE.Group();
    helipad.position.set(0, 0, 44);

    // Octagonal concrete landing pad
    const padGeo = new THREE.CylinderGeometry(14, 14.5, 0.4, 16);
    const padMesh = new THREE.Mesh(padGeo, concreteMat);
    padMesh.position.y = 0.2;
    padMesh.receiveShadow = true;
    helipad.add(padMesh);

    // Yellow hazard perimeter ring
    const ringGeo = new THREE.RingGeometry(11, 12.5, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ map: hazardTex, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.42;
    helipad.add(ring);

    // Large 'H' Landing Insignia
    const hBarMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const h1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 7.5), hBarMat);
    h1.position.set(-2.8, 0.43, 0);
    helipad.add(h1);

    const h2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 7.5), hBarMat);
    h2.position.set(2.8, 0.43, 0);
    helipad.add(h2);

    const h3 = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.05, 1.2), hBarMat);
    h3.position.set(0, 0.43, 0);
    helipad.add(h3);

    // Green beacon lights
    const heliLight = new THREE.PointLight(0x22c55e, 6.0, 35);
    heliLight.position.set(0, 4, 0);
    helipad.add(heliLight);

    // Extraction sky beam
    const beamGeo = new THREE.CylinderGeometry(0.4, 1.5, 45, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0, 22.5, 0);
    helipad.add(beam);

    // Evacuation Helicopter Mesh
    try {
      const chopper = HelicopterModel.createHelicopter();
      chopper.group.position.set(0, 0.4, 0);
      helipad.add(chopper.group);
    } catch (_) {}

    root.add(helipad);

    interactiveObjects.push({
      id: 'mission10_extraction_chopper',
      type: 'SAFEHOUSE',
      mesh: helipad,
      position: new THREE.Vector3(0, 0, 44),
      radius: 6.8,
      label: 'BOARD HELICOPTER WITH ALLIES',
      isActivated: false,
    });

    // 7. Explosive Barrels around the airfield
    const barrelCoords = [
      new THREE.Vector3(-12, 0, -12),
      new THREE.Vector3(12, 0, -12),
      new THREE.Vector3(-14, 0, 18),
      new THREE.Vector3(14, 0, 18),
      new THREE.Vector3(-10, 0, 36),
      new THREE.Vector3(10, 0, 36),
      new THREE.Vector3(-22, 0, -28),
      new THREE.Vector3(22, 0, 28),
    ];

    const barrelGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.3, 10);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.7 });

    barrelCoords.forEach((bp) => {
      const bMesh = new THREE.Mesh(barrelGeo, barrelMat.clone());
      bMesh.position.copy(bp);
      bMesh.position.y = 0.65;
      bMesh.castShadow = true;
      root.add(bMesh);

      explosiveBarrels.push({
        mesh: bMesh,
        position: bp.clone(),
        hp: 40,
        exploded: false,
      });

      const bbox = new THREE.Box3();
      bbox.setFromCenterAndSize(bMesh.position, new THREE.Vector3(1.1, 1.5, 1.1));
      colliderBoxes.push(bbox);
    });


    // ==========================================
    // HURDLE FIELDS — scattered cover across the expanded arena
    // ==========================================
    const keepOut = [{"x":16,"z":-18,"r":8},{"x":0,"z":36,"r":8},{"x":0,"z":0,"r":8},{"x":0,"z":44,"r":10},{"x":0,"z":-42,"r":9}];
    createHurdleField(root, colliderBoxes, { minX: -92, maxX: -26, minZ: -128, maxZ: 132, keepOut, count: 18, seed: 901 });
    createHurdleField(root, colliderBoxes, { minX: 26, maxX: 92, minZ: -128, maxZ: 132, keepOut, count: 18, seed: 902 });
    createHurdleField(root, colliderBoxes, { minX: -55, maxX: 55, minZ: -138, maxZ: -92, keepOut, count: 10, seed: 903 });
    createHurdleField(root, colliderBoxes, { minX: -55, maxX: 55, minZ: 62, maxZ: 136, keepOut, count: 10, seed: 904 });

    return {
      sceneGroup: root,
      colliderBoxes,
      interactiveObjects,
      explosiveBarrels,
      bounds: { minX: -105, maxX: 105, minZ: -143, maxZ: 143 },
      safehouseZone: {
        position: new THREE.Vector3(0, 0, 44),
        radius: 6.5,
      },
      playerSpawn: new THREE.Vector3(0, 0, -42),
      spawnPoints: [
        new THREE.Vector3(-28, 0, -45),
        new THREE.Vector3(28, 0, -45),
        new THREE.Vector3(-32, 0, 12),
        new THREE.Vector3(32, 0, 12),
        new THREE.Vector3(-24, 0, 50),
        new THREE.Vector3(24, 0, 50),
        new THREE.Vector3(0, 0, -60),
      ],
      narrowPathSpawns: [
        { spawn: new THREE.Vector3(36, 0, -18), exitPoint: new THREE.Vector3(24, 0, -18), name: 'East Hangar Alley' },
        { spawn: new THREE.Vector3(-36, 0, -20), exitPoint: new THREE.Vector3(-24, 0, -20), name: 'West Maintenance Chute' },
        { spawn: new THREE.Vector3(36, 0, 24), exitPoint: new THREE.Vector3(22, 0, 24), name: 'East Fuel Pipeline' },
        { spawn: new THREE.Vector3(-36, 0, 24), exitPoint: new THREE.Vector3(-22, 0, 24), name: 'West Perimeter Breach' },
      ],
      fogColor: 0x1e293b,
      fogDensity: 0.009,
      ambientColor: 0x94a3b8,
      ambientIntensity: 0.88,
      directionalColor: 0xfef08a,
      directionalIntensity: 2.2,
      directionalPos: [40, 65, 30],
    };
  }
}
