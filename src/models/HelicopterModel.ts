import * as THREE from 'three';
import { HelicopterAsset } from './HelicopterAsset';
import { ProceduralTextures } from '../textures/ProceduralTextures';

export interface HelicopterInstance {
  group: THREE.Group;
  mainRotor: THREE.Group;
  tailRotor: THREE.Group;
  searchLight: THREE.SpotLight;
  searchLightTarget: THREE.Object3D;
  cabinLight: THREE.PointLight;
}

export class HelicopterModel {
  public static createHelicopter(): HelicopterInstance {
    const group = new THREE.Group();
    group.name = 'military_blackhawk';

    // Military Olive Drab / Gunship Black metal
    const fuselageMat = new THREE.MeshStandardMaterial({
      color: 0x1c211a, // tactical matte olive black
      roughness: 0.65,
      metalness: 0.4,
    });

    const darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x111215,
      roughness: 0.45,
      metalness: 0.85,
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transmission: 0.75,
      transparent: true,
      opacity: 0.85,
      roughness: 0.1,
      ior: 1.5,
    });

    // ==========================================
    // 1. MAIN CABIN & COCKPIT FUSELAGE
    // ==========================================
    // High-detail authored model ("helicopter.glb") replaces the procedural
    // hull when it has finished streaming — rotor groups & lights stay.
    const glbBody = HelicopterAsset.getTemplate();
    if (glbBody) {
      [...group.children].forEach((child) => {
        if ((child as THREE.Mesh).isMesh) group.remove(child);
      });
    }

    const cabinGeo = new THREE.BoxGeometry(2.4, 2.1, 5.8);
    const cabin = new THREE.Mesh(cabinGeo, fuselageMat);
    cabin.position.set(0, 1.6, 0);
    cabin.castShadow = true;
    group.add(cabin);

    // Tapered Cockpit Nose
    const noseGeo = new THREE.ConeGeometry(1.4, 2.2, 8);
    noseGeo.rotateX(Math.PI / 2);
    noseGeo.scale(0.85, 0.75, 1.0);
    const nose = new THREE.Mesh(noseGeo, fuselageMat);
    nose.position.set(0, 1.35, -3.8);
    nose.castShadow = true;
    group.add(nose);

    // Curved Cockpit Windscreen Glass
    const windGeo = new THREE.BoxGeometry(2.1, 1.1, 1.6);
    windGeo.rotateX(-0.35);
    const windscreen = new THREE.Mesh(windGeo, glassMat);
    windscreen.position.set(0, 1.95, -2.9);
    group.add(windscreen);

    // Cockpit Instrument Glow
    const consoleGeo = new THREE.BoxGeometry(1.6, 0.4, 0.5);
    const consoleMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const consoleMesh = new THREE.Mesh(consoleGeo, consoleMat);
    consoleMesh.position.set(0, 1.4, -3.1);
    group.add(consoleMesh);

    // Open Side Cargo Bay Doors (Left & Right)
    const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x0f1110 });
    [-1.22, 1.22].forEach((sideX) => {
      const frameGeo = new THREE.BoxGeometry(0.1, 1.6, 2.4);
      const frame = new THREE.Mesh(frameGeo, doorFrameMat);
      frame.position.set(sideX, 1.4, 0.3);
      group.add(frame);
    });

    // Interior Cabin Bench & Fast-Rope Spool
    const benchGeo = new THREE.BoxGeometry(1.6, 0.4, 2.6);
    const bench = new THREE.Mesh(benchGeo, darkSteelMat);
    bench.position.set(0, 0.85, 0.4);
    group.add(bench);

    // Interior Cabin Red Tactical Dome Light
    const cabinLight = new THREE.PointLight(0xef4444, 2.5, 6);
    cabinLight.position.set(0, 2.3, 0);
    group.add(cabinLight);

    // ==========================================
    // 2. ENGINE COWLINGS & TWIN TURBOSHAFT EXHAUSTS
    // ==========================================
    const engineGeo = new THREE.CylinderGeometry(0.7, 0.8, 4.2, 12);
    engineGeo.rotateX(Math.PI / 2);
    const engine = new THREE.Mesh(engineGeo, fuselageMat);
    engine.position.set(0, 2.8, -0.2);
    group.add(engine);

    // Dual Angled Exhaust Pipes
    [-0.9, 0.9].forEach((exX) => {
      const exGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.8, 10);
      exGeo.rotateZ(exX > 0 ? -0.4 : 0.4);
      const pipe = new THREE.Mesh(exGeo, darkSteelMat);
      pipe.position.set(exX, 2.7, 1.2);
      group.add(pipe);
    });

    // ==========================================
    // 3. MAIN ROTOR MAST & 4 SPINNING COMPOSITE BLADES
    // ==========================================
    const mainRotor = new THREE.Group();
    mainRotor.position.set(0, 3.4, -0.2);

    const mastGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.9, 12);
    const mast = new THREE.Mesh(mastGeo, darkSteelMat);
    mainRotor.add(mast);

    const hubGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.25, 12);
    const hub = new THREE.Mesh(hubGeo, darkSteelMat);
    hub.position.y = 0.45;
    mainRotor.add(hub);

    // 4 Aerodynamic Rotor Blades (11-meter diameter rotor disk)
    const bladeGeo = new THREE.BoxGeometry(0.35, 0.04, 5.4);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x141618,
      roughness: 0.4,
      metalness: 0.8,
    });

    // Tip warning stripes
    const tipMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

    for (let b = 0; b < 4; b++) {
      const angle = (b * Math.PI) / 2;
      const bladeArm = new THREE.Group();
      bladeArm.rotation.y = angle;

      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.set(0, 0.45, 2.9);
      bladeArm.add(blade);

      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.4), tipMat);
      tip.position.set(0, 0.45, 5.4);
      bladeArm.add(tip);

      mainRotor.add(bladeArm);
    }
    group.add(mainRotor);

    // ==========================================
    // 4. TAIL BOOM, VERTICAL FIN & TAIL ROTOR
    // ==========================================
    const boomGeo = new THREE.CylinderGeometry(0.35, 0.7, 6.5, 10);
    boomGeo.rotateX(Math.PI / 2);
    const boom = new THREE.Mesh(boomGeo, fuselageMat);
    boom.position.set(0, 1.8, 5.6);
    group.add(boom);

    // Horizontal Stabilizer Wing
    const wingGeo = new THREE.BoxGeometry(3.6, 0.1, 0.8);
    const wing = new THREE.Mesh(wingGeo, fuselageMat);
    wing.position.set(0, 2.1, 8.2);
    group.add(wing);

    // Vertical Fin & Tail Pylon
    const finGeo = new THREE.BoxGeometry(0.18, 2.4, 1.5);
    finGeo.rotateX(-0.35);
    const fin = new THREE.Mesh(finGeo, fuselageMat);
    fin.position.set(0, 2.9, 8.8);
    group.add(fin);

    // Tail Rotor
    const tailRotor = new THREE.Group();
    tailRotor.position.set(0.35, 3.4, 9.2);

    const tailHubGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.15, 8);
    tailHubGeo.rotateZ(Math.PI / 2);
    const tailHub = new THREE.Mesh(tailHubGeo, darkSteelMat);
    tailRotor.add(tailHub);

    for (let tb = 0; tb < 4; tb++) {
      const tbAngle = (tb * Math.PI) / 2;
      const tBladeGeo = new THREE.BoxGeometry(0.12, 1.4, 0.02);
      const tBlade = new THREE.Mesh(tBladeGeo, bladeMat);
      tBlade.rotation.x = tbAngle;
      tBlade.position.set(0.08, Math.sin(tbAngle) * 0.7, Math.cos(tbAngle) * 0.7);
      tailRotor.add(tBlade);
    }
    group.add(tailRotor);

    // Tail flashing anti-collision strobe
    const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    strobe.position.set(0, 4.2, 9.2);
    group.add(strobe);

    // ==========================================
    // 5. HEAVY LANDING SKIDS & STRUTS
    // ==========================================
    const skidMat = darkSteelMat;
    [-1.4, 1.4].forEach((skidX) => {
      // Long tubular skid runner
      const runnerGeo = new THREE.CylinderGeometry(0.08, 0.08, 6.2, 10);
      runnerGeo.rotateX(Math.PI / 2);
      const runner = new THREE.Mesh(runnerGeo, skidMat);
      runner.position.set(skidX, 0.15, 0.2);
      group.add(runner);

      // Curved skid front tip
      const tipGeo = new THREE.TorusGeometry(0.5, 0.08, 6, 8, Math.PI / 3);
      tipGeo.rotateY(Math.PI / 2);
      const curvedTip = new THREE.Mesh(tipGeo, skidMat);
      curvedTip.position.set(skidX, 0.45, -2.9);
      group.add(curvedTip);

      // Shock struts connecting skid to fuselage
      [-1.4, 1.6].forEach((strutZ) => {
        const strutGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.4, 8);
        strutGeo.rotateZ(skidX > 0 ? 0.45 : -0.45);
        const strut = new THREE.Mesh(strutGeo, skidMat);
        strut.position.set(skidX * 0.75, 0.85, strutZ);
        group.add(strut);
      });
    });

    // ==========================================
    // 6. HIGH-INTENSITY GIMBAL SEARCHLIGHT
    // ==========================================
    const searchLightTarget = new THREE.Object3D();
    searchLightTarget.position.set(0, 0, 0);
    group.add(searchLightTarget);

    const searchLightHousing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.32, 0.4, 12),
      darkSteelMat
    );
    searchLightHousing.rotateX(Math.PI / 2);
    searchLightHousing.position.set(0, 0.45, -3.2);
    group.add(searchLightHousing);

    const searchLightLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.05, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    searchLightLens.rotateX(Math.PI / 2);
    searchLightLens.position.set(0, 0.45, -3.42);
    group.add(searchLightLens);

    const searchLight = new THREE.SpotLight(0xf8fafc, 6.0, 60, Math.PI / 4.5, 0.4, 1.2);
    searchLight.position.set(0, 0.45, -3.4);
    searchLight.target = searchLightTarget;
    searchLight.castShadow = true;
    group.add(searchLight);

    // Authored body: add it, then re-seat the authored rotor meshes under the
    // mainRotor / tailRotor groups so the existing spin animation still drives them
    if (glbBody) {
      group.add(glbBody);
      glbBody.updateMatrixWorld(true);

      const authored: THREE.Mesh[] = [];
      glbBody.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && /rotor|blade|prop/i.test(o.name)) {
          authored.push(o as THREE.Mesh);
        }
      });

      const reseat = (mesh: THREE.Mesh, targetGroup: THREE.Group) => {
        mesh.updateWorldMatrix(true, false);
        const hubWorld = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld);
        targetGroup.position.copy(hubWorld);
        targetGroup.attach(mesh);
      };

      if (authored.length > 0) reseat(authored[0], mainRotor);
      if (authored.length > 1) reseat(authored[1], tailRotor);
    }

    return {
      group,
      mainRotor,
      tailRotor,
      searchLight,
      searchLightTarget,
      cabinLight,
    };
  }
}
