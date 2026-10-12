import * as THREE from 'three';
import { ProceduralTextures } from '../../textures/ProceduralTextures';
import { EnvironmentResult, createHurdleField, InteractiveObject } from '../EnvironmentBuilder';

export class CheckpointBravoMap {
  public static build(): EnvironmentResult {
    const root = new THREE.Group();
    root.name = 'checkpoint_bravo_district';

    const colliderBoxes: THREE.Box3[] = [];
    const interactiveObjects: InteractiveObject[] = [];
    const explosiveBarrels: { mesh: THREE.Mesh; position: THREE.Vector3; hp: number; exploded: boolean }[] = [];

    // Textures
    const asphaltTex = ProceduralTextures.getAsphalt();
    asphaltTex.repeat.set(4, 20);

    const sandbagTex = ProceduralTextures.getSandbagBurlap();
    const concreteTex = ProceduralTextures.getConcreteWall();
    const hazardTex = ProceduralTextures.getHazardStripes();
    const camoTex = ProceduralTextures.getCamoFabric();

    // Materials
    const groundMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: 0.85,
      metalness: 0.1,
    });

    const sandbagMat = new THREE.MeshStandardMaterial({
      map: sandbagTex,
      roughness: 0.9,
      metalness: 0.05,
    });

    const concreteMat = new THREE.MeshStandardMaterial({
      map: concreteTex,
      roughness: 0.85,
      metalness: 0.15,
      color: 0x52525b,
    });

    const militaryMat = new THREE.MeshStandardMaterial({
      map: camoTex,
      roughness: 0.7,
      metalness: 0.2,
      color: 0x365314, // tactical olive drab
    });

    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.5,
      metalness: 0.8,
    });

    // 1. Ground - Battle-worn military highway (expanded 170m x 230m)
    const groundGeo = new THREE.PlaneGeometry(240, 320);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.receiveShadow = true;
    root.add(groundMesh);

    // Perimeter Containment Wall
    const wallConfigs = [
      { x: -110, z: 0, w: 2, h: 10, d: 300 }, // West wall
      { x: 110, z: 0, w: 2, h: 10, d: 300 },  // East wall
      { x: 0, z: -148, w: 224, h: 10, d: 2 },  // North bunker wall
      { x: 0, z: 148, w: 224, h: 10, d: 2 },   // South containment gate
    ];

    for (const wc of wallConfigs) {
      const geo = new THREE.BoxGeometry(wc.w, wc.h, wc.d);
      const wall = new THREE.Mesh(geo, concreteMat);
      wall.position.set(wc.x, wc.h / 2, wc.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      root.add(wall);

      const box = new THREE.Box3();
      box.setFromCenterAndSize(wall.position, new THREE.Vector3(wc.w, wc.h, wc.d));
      colliderBoxes.push(box);
    }

    // 2. Primary Sandbag Defense Line across z = -12
    // Staggered sandbag walls with firing ports
    const sandbagSegments = [
      { x: -20, z: -12, w: 14, h: 1.4, d: 1.6 },
      { x: -4, z: -12, w: 12, h: 1.4, d: 1.6 },
      { x: 12, z: -12, w: 14, h: 1.4, d: 1.6 },
      // Secondary flank trenches
      { x: -16, z: -20, w: 1.6, h: 1.4, d: 12 },
      { x: 16, z: -20, w: 1.6, h: 1.4, d: 12 },
    ];

    for (const seg of sandbagSegments) {
      const geo = new THREE.BoxGeometry(seg.w, seg.h, seg.d);
      const mesh = new THREE.Mesh(geo, sandbagMat);
      mesh.position.set(seg.x, seg.h / 2, seg.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);

      const box = new THREE.Box3();
      box.setFromCenterAndSize(mesh.position, new THREE.Vector3(seg.w + 0.2, seg.h, seg.d + 0.2));
      colliderBoxes.push(box);
    }

    // 3. Military Guard Watchtowers with Searchlights
    const towerCoords = [
      { x: -22, z: -25 },
      { x: 22, z: -25 },
    ];

    for (const tc of towerCoords) {
      const towerGroup = new THREE.Group();
      towerGroup.position.set(tc.x, 0, tc.z);

      // 4 Heavy Steel Legs
      for (const lx of [-2, 2]) {
        for (const lz of [-2, 2]) {
          const legGeo = new THREE.CylinderGeometry(0.2, 0.2, 10, 6);
          const leg = new THREE.Mesh(legGeo, steelMat);
          leg.position.set(lx, 5, lz);
          towerGroup.add(leg);
        }
      }

      // Observation Platform Cabin
      const cabGeo = new THREE.BoxGeometry(5.2, 3.2, 5.2);
      const cab = new THREE.Mesh(cabGeo, militaryMat);
      cab.position.y = 11;
      cab.castShadow = true;
      towerGroup.add(cab);

      // Searchlight Dome
      const lightDomeGeo = new THREE.SphereGeometry(0.6, 8, 8);
      const lightDome = new THREE.Mesh(lightDomeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      lightDome.position.set(0, 9.2, 2.2);
      towerGroup.add(lightDome);

      // Intense Spotlight illuminating the killing field ahead
      const spotLight = new THREE.SpotLight(0xffffff, 4.0, 65, Math.PI / 5, 0.4);
      spotLight.position.set(0, 9.2, 2.2);
      spotLight.target.position.set(tc.x * 0.5, 0, 15);
      root.add(spotLight.target);
      towerGroup.add(spotLight);

      root.add(towerGroup);

      const tBox = new THREE.Box3();
      tBox.setFromCenterAndSize(new THREE.Vector3(tc.x, 5, tc.z), new THREE.Vector3(5.0, 10, 5.0));
      colliderBoxes.push(tBox);
    }

    // 4. Wrecked Military Heavy Transport Truck at [-6, 0, 5]
    const truckGroup = new THREE.Group();
    truckGroup.position.set(-6, 0, 5);
    truckGroup.rotation.y = 0.35;

    // Chassis & Engine Cab
    const cabGeo = new THREE.BoxGeometry(3.2, 2.8, 4.0);
    const truckCab = new THREE.Mesh(cabGeo, militaryMat);
    truckCab.position.set(0, 1.8, 2.5);
    truckCab.castShadow = true;
    truckGroup.add(truckCab);

    // Flatbed Cargo Area with Canvas Top
    const bedGeo = new THREE.BoxGeometry(3.4, 3.4, 7.0);
    const truckBed = new THREE.Mesh(bedGeo, militaryMat);
    truckBed.position.set(0, 2.2, -2.8);
    truckBed.castShadow = true;
    truckGroup.add(truckBed);

    // Heavy Wheels
    for (const wx of [-1.8, 1.8]) {
      for (const wz of [-4.5, -1.5, 3.2]) {
        const wheelGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.6, 10);
        wheelGeo.rotateZ(Math.PI / 2);
        const wheel = new THREE.Mesh(wheelGeo, steelMat);
        wheel.position.set(wx, 0.7, wz);
        wheel.castShadow = true;
        truckGroup.add(wheel);
      }
    }

    root.add(truckGroup);

    const truckBox = new THREE.Box3();
    truckBox.setFromCenterAndSize(new THREE.Vector3(-6, 2, 5), new THREE.Vector3(5.0, 3.8, 11.0));
    colliderBoxes.push(truckBox);

    // 5. Dragon's Teeth Concrete Obstacles in the field
    const dtGeo = new THREE.ConeGeometry(1.2, 2.0, 4);
    dtGeo.rotateY(Math.PI / 4);
    for (let x = -24; x <= 24; x += 6) {
      const dt = new THREE.Mesh(dtGeo, concreteMat);
      dt.position.set(x + (Math.random() - 0.5) * 2, 1.0, 18 + (Math.random() - 0.5) * 3);
      dt.castShadow = true;
      root.add(dt);

      const dBox = new THREE.Box3();
      dBox.setFromCenterAndSize(dt.position, new THREE.Vector3(2.0, 2.0, 2.0));
      colliderBoxes.push(dBox);
    }

    // 6. Command Bunker & Safehouse at [0, 0, -42]
    const bunkerGroup = new THREE.Group();
    bunkerGroup.position.set(0, 0, -42);

    const bGeo = new THREE.BoxGeometry(16, 6.5, 10);
    const bMesh = new THREE.Mesh(bGeo, concreteMat);
    bMesh.position.y = 3.25;
    bunkerGroup.add(bMesh);

    // Steel Vault Door with Hazard Stripes
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(5.0, 4.5, 0.4),
      new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.5, metalness: 0.5 })
    );
    door.position.set(0, 2.25, 5.1);
    bunkerGroup.add(door);

    // Extraction Landing Beacon
    const ringGeo = new THREE.RingGeometry(0.4, 4.2, 28);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(0, 0.04, 8.0);
    bunkerGroup.add(ring);

    const bunkerLight = new THREE.PointLight(0x22c55e, 3.2, 16);
    bunkerLight.position.set(0, 3.0, 8.0);
    bunkerGroup.add(bunkerLight);

    root.add(bunkerGroup);

    const bunkerBox = new THREE.Box3();
    bunkerBox.setFromCenterAndSize(new THREE.Vector3(0, 3.25, -42), new THREE.Vector3(16.5, 6.5, 10.5));
    colliderBoxes.push(bunkerBox);

    interactiveObjects.push({
      id: 'checkpoint_bravo_safehouse',
      type: 'SAFEHOUSE',
      mesh: bunkerGroup,
      position: new THREE.Vector3(0, 0, -34),
      radius: 5.0,
      label: 'DEFENSE LINE BUNKER',
      isActivated: false,
    });

    // 7. Tactical Explosive Barrels placed at defensive chokepoints
    const barrelCoords = [
      new THREE.Vector3(-10, 0, -5),
      new THREE.Vector3(-8.8, 0, -5),
      new THREE.Vector3(4, 0, -4),
      new THREE.Vector3(5.2, 0, -4),
      new THREE.Vector3(18, 0, 0),
      new THREE.Vector3(-18, 0, 10),
      new THREE.Vector3(0, 0, 14),
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
    // buildOuterDistricts: when false (default), skips the far decorative
    // hurdle fields outside the playable corridor. No spawns/interactives
    // live there — only visual backdrop. Saves ~35% env meshes & build time.
    const buildOuterDistricts = false;
    const keepOut = [{"x":0,"z":-42,"r":10},{"x":0,"z":-12,"r":12},{"x":0,"z":-25,"r":8},{"x":-6,"z":5,"r":9}];
    if (buildOuterDistricts) {
      createHurdleField(root, colliderBoxes, { minX: -92, maxX: -26, minZ: -128, maxZ: 132, keepOut, count: 18, seed: 701 });
      createHurdleField(root, colliderBoxes, { minX: 26, maxX: 92, minZ: -128, maxZ: 132, keepOut, count: 18, seed: 702 });
      createHurdleField(root, colliderBoxes, { minX: -55, maxX: 55, minZ: -138, maxZ: -92, keepOut, count: 10, seed: 703 });
      createHurdleField(root, colliderBoxes, { minX: -55, maxX: 55, minZ: 62, maxZ: 136, keepOut, count: 10, seed: 704 });
    }

    return {
      sceneGroup: root,
      colliderBoxes,
      interactiveObjects,
      explosiveBarrels,
      // Tightened to playable area (spawns ~Z=-42 to Z=-12)
      bounds: { minX: -70, maxX: 70, minZ: -52, maxZ: -2 },
      safehouseZone: {
        position: new THREE.Vector3(0, 0, -34),
        radius: 5.0,
      },
      playerSpawn: new THREE.Vector3(0, 0, -25), // Defending behind the sandbags
      spawnPoints: [
        new THREE.Vector3(-20, 0, 15),
        new THREE.Vector3(-10, 0, 25),
        new THREE.Vector3(0, 0, 36),
        new THREE.Vector3(12, 0, 25),
        new THREE.Vector3(22, 0, 15),
        new THREE.Vector3(-6, 0, 42),
        new THREE.Vector3(8, 0, 40),
      ],
      narrowPathSpawns: [
        // Trench flank left
        {
          spawn: new THREE.Vector3(-22, 0, 4),
          exitPoint: new THREE.Vector3(-10, 0, 4),
          name: 'West Trench Flank',
        },
        // Trench flank right
        {
          spawn: new THREE.Vector3(22, 0, 4),
          exitPoint: new THREE.Vector3(10, 0, 4),
          name: 'East Trench Flank',
        },
        // Wrecked APC cover corridor
        {
          spawn: new THREE.Vector3(-18, 0, 26),
          exitPoint: new THREE.Vector3(-8, 0, 26),
          name: 'APC Wreckage Path',
        },
        // Barbed wire perimeter gap
        {
          spawn: new THREE.Vector3(20, 0, 30),
          exitPoint: new THREE.Vector3(10, 0, 30),
          name: 'Perimeter Breach',
        },
      ],
      fogColor: 0x8cbfe8, // Clear sunny sky fog
      fogDensity: 0.007,
      ambientColor: 0xb2d6f2, // High-visibility daylight ambient
      ambientIntensity: 1.0,
      directionalColor: 0xfff7e6, // Bright sunny directional light
      directionalIntensity: 2.4,
      directionalPos: [0, 50, -40],
    };
  }
}
