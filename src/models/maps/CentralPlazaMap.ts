import * as THREE from 'three';
import { ProceduralTextures } from '../../textures/ProceduralTextures';
import { EnvironmentResult, createHurdleField, InteractiveObject } from '../EnvironmentBuilder';
import { HelicopterModel } from '../HelicopterModel';

export class CentralPlazaMap {
  public static build(): EnvironmentResult {
    const root = new THREE.Group();
    root.name = 'central_plaza_arena';

    const colliderBoxes: THREE.Box3[] = [];
    const interactiveObjects: InteractiveObject[] = [];
    const explosiveBarrels: { mesh: THREE.Mesh; position: THREE.Vector3; hp: number; exploded: boolean }[] = [];

    // Textures
    const cobbleTex = ProceduralTextures.getPlazaCobblestone();
    cobbleTex.repeat.set(8, 12);

    const marbleTex = ProceduralTextures.getMarbleTile();
    const concreteTex = ProceduralTextures.getConcreteWall();
    const rustTex = ProceduralTextures.getRustedMetal();
    const hazardTex = ProceduralTextures.getHazardStripes();

    // Materials
    const groundMat = new THREE.MeshStandardMaterial({
      map: cobbleTex,
      roughness: 0.8,
      metalness: 0.1,
      color: 0x57534e,
    });

    const stoneMat = new THREE.MeshStandardMaterial({
      map: marbleTex,
      roughness: 0.6,
      metalness: 0.1,
      color: 0xd6d3d1,
    });

    const wallMat = new THREE.MeshStandardMaterial({
      map: concreteTex,
      roughness: 0.85,
      metalness: 0.15,
      color: 0x44403c,
    });

    const wreckMat = new THREE.MeshStandardMaterial({
      map: rustTex,
      roughness: 0.7,
      metalness: 0.6,
      color: 0x292524,
    });

    // 1. Grand Plaza Cobblestone Ground (expanded 180m x 240m)
    const groundGeo = new THREE.PlaneGeometry(240, 320);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.receiveShadow = true;
    root.add(groundMesh);

    // Perimeter Monumental Walls & Neoclassical Colonnade
    const wallConfigs = [
      { x: -110, z: 0, w: 2, h: 14, d: 300 }, // West wall
      { x: 110, z: 0, w: 2, h: 14, d: 300 },  // East wall
      { x: 0, z: -148, w: 224, h: 14, d: 2 },  // North wall
      { x: 0, z: 148, w: 224, h: 14, d: 2 },   // South wall
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

    // Colonnade Pillars flanking the arena sides (Provides tactical cover when kiting the Colossus)
    const pillarGeo = new THREE.CylinderGeometry(0.8, 1.0, 10, 12);
    for (const pz of [-40, -25, -10, 5, 20, 35]) {
      for (const px of [-26, 26]) {
        const pillar = new THREE.Mesh(pillarGeo, stoneMat);
        pillar.position.set(px, 5, pz);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        root.add(pillar);

        const pBox = new THREE.Box3();
        pBox.setFromCenterAndSize(pillar.position, new THREE.Vector3(2.2, 10, 2.2));
        colliderBoxes.push(pBox);
      }
    }

    // 2. Central Shattered Obelisk Monument at [0, 0, 0]
    const monumentGroup = new THREE.Group();
    monumentGroup.position.set(0, 0, 0);

    // Stepped circular stone plinth
    const plinth1 = new THREE.Mesh(new THREE.CylinderGeometry(8, 9, 1.2, 16), stoneMat);
    plinth1.position.y = 0.6;
    plinth1.castShadow = true;
    monumentGroup.add(plinth1);

    const plinth2 = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6, 1.2, 16), stoneMat);
    plinth2.position.y = 1.8;
    plinth2.castShadow = true;
    monumentGroup.add(plinth2);

    // Broken Obelisk Spire
    const obeliskGeo = new THREE.ConeGeometry(1.6, 7, 4);
    obeliskGeo.rotateY(Math.PI / 4);
    const obelisk = new THREE.Mesh(obeliskGeo, stoneMat);
    obelisk.position.set(0, 5.5, 0);
    obelisk.rotation.z = 0.18; // Tilted broken angle
    obelisk.castShadow = true;
    monumentGroup.add(obelisk);

    root.add(monumentGroup);

    const monBox = new THREE.Box3();
    monBox.setFromCenterAndSize(new THREE.Vector3(0, 3.5, 0), new THREE.Vector3(12, 7, 12));
    colliderBoxes.push(monBox);

    // 3. Crashed Military Gunship Wreckage at [-14, 0, 10]
    const wreckGroup = new THREE.Group();
    wreckGroup.position.set(-14, 0, 10);
    wreckGroup.rotation.y = -0.4;
    wreckGroup.rotation.z = 0.2;

    // Fuselage
    const fuseGeo = new THREE.BoxGeometry(4.5, 3.6, 11);
    const fuselage = new THREE.Mesh(fuseGeo, wreckMat);
    fuselage.position.y = 2.0;
    fuselage.castShadow = true;
    wreckGroup.add(fuselage);

    // Broken Wing / Rotor stub
    const wingGeo = new THREE.BoxGeometry(10, 0.4, 2.2);
    const wing = new THREE.Mesh(wingGeo, wreckMat);
    wing.position.set(2.5, 2.8, -1.0);
    wreckGroup.add(wing);

    // Fire & ember point light from burning engine
    const fireLight = new THREE.PointLight(0xf97316, 4.0, 18);
    fireLight.position.set(0, 2.5, -3);
    wreckGroup.add(fireLight);

    root.add(wreckGroup);

    const wreckBox = new THREE.Box3();
    wreckBox.setFromCenterAndSize(new THREE.Vector3(-14, 2.5, 10), new THREE.Vector3(7, 4.5, 12));
    colliderBoxes.push(wreckBox);

    // 4. Collapsed Subway Concourse Entrance at [14, 0, -12]
    const subwayGroup = new THREE.Group();
    subwayGroup.position.set(14, 0, -12);

    const subWallGeo = new THREE.BoxGeometry(7, 2.4, 8);
    const subWall = new THREE.Mesh(subWallGeo, wallMat);
    subWall.position.y = 1.2;
    subWall.castShadow = true;
    subwayGroup.add(subWall);

    // Subway sign canopy
    const canopyGeo = new THREE.BoxGeometry(7.2, 0.4, 4);
    const canopy = new THREE.Mesh(canopyGeo, stoneMat);
    canopy.position.set(0, 3.2, 2.0);
    subwayGroup.add(canopy);

    root.add(subwayGroup);

    const subBox = new THREE.Box3();
    subBox.setFromCenterAndSize(new THREE.Vector3(14, 1.6, -12), new THREE.Vector3(7.5, 3.5, 8.5));
    colliderBoxes.push(subBox);

    // 5. Final Extraction Chopper Helipad at [0, 0, 44]
    const helipadGroup = new THREE.Group();
    helipadGroup.position.set(0, 0, 44);

    // Circular Helipad Base
    const padGeo = new THREE.CylinderGeometry(8, 8, 0.2, 24);
    const padMat = new THREE.MeshStandardMaterial({
      map: concreteTex,
      roughness: 0.8,
      metalness: 0.1,
    });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.y = 0.1;
    helipadGroup.add(pad);

    // Yellow "H" Marking ring
    const ringGeo = new THREE.RingGeometry(0.5, 5.5, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(0, 0.22, 0);
    helipadGroup.add(ring);

    // Extraction Beacon Lights (Emerald Green)
    const heliLight = new THREE.PointLight(0x22c55e, 5.0, 30);
    heliLight.position.set(0, 3.5, 0);
    helipadGroup.add(heliLight);

    // Visible extraction sky pillar beam
    const beamGeo = new THREE.CylinderGeometry(0.35, 1.2, 35, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0, 17.5, 0);
    helipadGroup.add(beam);

    // Evacuation Helicopter
    try {
      const heli = HelicopterModel.createHelicopter();
      heli.group.position.set(0, 0.4, 0);
      heli.group.scale.set(0.9, 0.9, 0.9);
      helipadGroup.add(heli.group);
    } catch (_) {}

    root.add(helipadGroup);

    interactiveObjects.push({
      id: 'chopper_extraction_helipad',
      type: 'SAFEHOUSE',
      mesh: helipadGroup,
      position: new THREE.Vector3(0, 0, 44),
      radius: 6.5,
      label: 'BOARD EXTRACTION CHOPPER',
      isActivated: false,
    });

    // 6. Plentiful Explosive Barrels across the arena for tactical boss fighting
    const barrelCoords = [
      new THREE.Vector3(-8, 0, -8),
      new THREE.Vector3(8, 0, -8),
      new THREE.Vector3(-10, 0, 18),
      new THREE.Vector3(10, 0, 18),
      new THREE.Vector3(-18, 0, -18),
      new THREE.Vector3(18, 0, -18),
      new THREE.Vector3(0, 0, 24),
      new THREE.Vector3(0, 0, -18),
    ];

    const barrelGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.3, 10);
    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      metalness: 0.7,
      roughness: 0.35,
    });

    for (const bPos of barrelCoords) {
      const barrel = new THREE.Mesh(barrelGeo, barrelMat.clone());
      barrel.position.copy(bPos);
      barrel.position.y = 0.65;
      barrel.castShadow = true;
      root.add(barrel);

      explosiveBarrels.push({
        mesh: barrel,
        position: bPos.clone(),
        hp: 40,
        exploded: false,
      });

      const bbox = new THREE.Box3();
      bbox.setFromCenterAndSize(barrel.position, new THREE.Vector3(1.1, 1.5, 1.1));
      colliderBoxes.push(bbox);
    }


    // ==========================================
    // HURDLE FIELDS — scattered cover across the expanded arena
    // ==========================================
    // buildOuterDistricts: when false (default), skips the far decorative
    // hurdle fields outside the playable corridor. No spawns/interactives
    // live there — only visual backdrop. Saves ~35% env meshes & build time.
    const buildOuterDistricts = false;
    const keepOut = [{"x":0,"z":0,"r":12},{"x":-14,"z":10,"r":10},{"x":0,"z":44,"r":10},{"x":14,"z":-12,"r":9},{"x":0,"z":-32,"r":9}];
    if (buildOuterDistricts) {
      createHurdleField(root, colliderBoxes, { minX: -92, maxX: -26, minZ: -128, maxZ: 132, keepOut, count: 18, seed: 801 });
      createHurdleField(root, colliderBoxes, { minX: 26, maxX: 92, minZ: -128, maxZ: 132, keepOut, count: 18, seed: 802 });
      createHurdleField(root, colliderBoxes, { minX: -55, maxX: 55, minZ: -138, maxZ: -92, keepOut, count: 10, seed: 803 });
      createHurdleField(root, colliderBoxes, { minX: -55, maxX: 55, minZ: 62, maxZ: 136, keepOut, count: 10, seed: 804 });
    }

    return {
      sceneGroup: root,
      colliderBoxes,
      interactiveObjects,
      explosiveBarrels,
      // Tightened to playable area (spawns ~Z=-32 to Z=44)
      bounds: { minX: -70, maxX: 70, minZ: -42, maxZ: 54 },
      safehouseZone: {
        position: new THREE.Vector3(0, 0, 44),
        radius: 5.5,
      },
      playerSpawn: new THREE.Vector3(0, 0, -32),
      spawnPoints: [
        new THREE.Vector3(0, 0, 8), // Boss Colossus primary entry point!
        new THREE.Vector3(-22, 0, -4),
        new THREE.Vector3(22, 0, -4),
        new THREE.Vector3(-18, 0, 22),
        new THREE.Vector3(18, 0, 22),
        new THREE.Vector3(0, 0, 32),
      ],
      narrowPathSpawns: [
        // West colonnade arch passage
        {
          spawn: new THREE.Vector3(-26, 0, 6),
          exitPoint: new THREE.Vector3(-12, 0, 6),
          name: 'West Arcade Passage',
        },
        // East colonnade arch passage
        {
          spawn: new THREE.Vector3(26, 0, 6),
          exitPoint: new THREE.Vector3(12, 0, 6),
          name: 'East Arcade Passage',
        },
        // North ruined hall crevice
        {
          spawn: new THREE.Vector3(-16, 0, 32),
          exitPoint: new THREE.Vector3(-6, 0, 30),
          name: 'North Hall Crevice',
        },
        // South fountain flank
        {
          spawn: new THREE.Vector3(16, 0, -14),
          exitPoint: new THREE.Vector3(6, 0, -14),
          name: 'South Memorial Flank',
        },
      ],
      fogColor: 0x270707, // Apocalyptic blood-red ember fog
      fogDensity: 0.022,
      ambientColor: 0x5c1d1d,
      ambientIntensity: 0.72,
      directionalColor: 0xfca5a5,
      directionalIntensity: 1.9,
      directionalPos: [15, 60, 20],
    };
  }
}
