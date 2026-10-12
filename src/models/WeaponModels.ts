import * as THREE from 'three';
import { WeaponTypeKey } from '../types';
import { ProceduralTextures } from '../textures/ProceduralTextures';
import { HeavyWeaponModel } from './HeavyWeaponModel';

export class WeaponModelFactory {
  private static gunMetalMat: THREE.MeshStandardMaterial | null = null;
  private static darkSteelMat: THREE.MeshStandardMaterial | null = null;
  private static tacticalGripMat: THREE.MeshStandardMaterial | null = null;
  private static holoGlassMat: THREE.MeshPhysicalMaterial | null = null;
  private static holoDotMat: THREE.MeshBasicMaterial | null = null;
  private static laserBeamMat: THREE.MeshBasicMaterial | null = null;
  private static gloveMat: THREE.MeshStandardMaterial | null = null;
  private static knuckleMat: THREE.MeshStandardMaterial | null = null;
  private static sleeveMat: THREE.MeshStandardMaterial | null = null;
  private static brassMat: THREE.MeshStandardMaterial | null = null;

  private static initMaterials() {
    if (this.gunMetalMat) return;

    this.gunMetalMat = new THREE.MeshStandardMaterial({
      color: 0x24282c,
      metalness: 0.88,
      roughness: 0.22,
    });

    this.darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x151619,
      metalness: 0.92,
      roughness: 0.32,
    });

    this.tacticalGripMat = new THREE.MeshStandardMaterial({
      color: 0x1c1d21,
      metalness: 0.15,
      roughness: 0.82,
    });

    this.holoGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x00ffff,
      transmission: 0.88,
      opacity: 0.9,
      transparent: true,
      roughness: 0.05,
      ior: 1.52,
    });

    this.holoDotMat = new THREE.MeshBasicMaterial({
      color: 0xff1e1e,
    });

    this.laserBeamMat = new THREE.MeshBasicMaterial({
      color: 0xff0505,
      transparent: true,
      opacity: 0.45,
    });

    this.gloveMat = new THREE.MeshStandardMaterial({
      color: 0x222226,
      roughness: 0.8,
      metalness: 0.1,
    });

    this.knuckleMat = new THREE.MeshStandardMaterial({
      color: 0x111113,
      roughness: 0.35,
      metalness: 0.6,
    });

    this.sleeveMat = new THREE.MeshStandardMaterial({
      color: 0x363d30, // Military camouflage olive drab
      map: ProceduralTextures.getCamoFabric(),
      roughness: 0.85,
    });

    this.brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.95,
      roughness: 0.2,
    });
  }

  public static createWeaponMesh(type: WeaponTypeKey): THREE.Group {
    this.initMaterials();
    const group = new THREE.Group();
    group.name = `weapon_${type}`;

    // Weapon body
    let gunMesh: THREE.Group;
    switch (type) {
      case 'shotgun':
        gunMesh = this.createShotgun();
        break;
      case 'rifle':
        gunMesh = this.createRifle();
        break;
      case 'smg':
        gunMesh = this.createSMG();
        break;
      case 'heavy':
        gunMesh = this.createHeavy();
        break;
      case 'sniper':
        gunMesh = this.createSniper();
        break;
      case 'rocket':
        gunMesh = this.createRocket();
        break;
      case 'katana':
        gunMesh = this.createKatana();
        break;
      case 'airstrike':
        gunMesh = this.createAirstrikeTablet();
        break;
      case 'pistol':
      default:
        gunMesh = this.createPistol();
        break;
    }

    group.add(gunMesh);

    // Add operator arms & tactical gloves
    const hands = this.createHandsAndArms(type);
    group.add(hands);

    // Tactical first-person weapon positioning
    if (type === 'airstrike') {
      // Tablet held flat with both hands at chest level, screen facing player
      group.position.set(0.08, -0.18, -0.35);
      group.rotation.set(-Math.PI / 3.5, 0, 0); // Tilt screen toward player's eyes
      group.scale.set(0.75, 0.75, 0.75);
    } else {
      group.position.set(0.23, -0.21, -0.44);
      group.scale.set(0.85, 0.85, 0.85);
    }

    return group;
  }

  // ==========================================
  // 7. HAVOC RPG-X ROCKET LAUNCHER
  // ==========================================
  private static createRocket(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'gun_geometry';

    // Launch tube (fiber-wound composite)
    const tubeGeo = new THREE.CylinderGeometry(0.058, 0.058, 0.66, 16);
    tubeGeo.rotateX(Math.PI / 2);
    const tube = new THREE.Mesh(tubeGeo, this.gunMetalMat!);
    tube.position.set(0, 0.02, -0.18);
    root.add(tube);

    // Heat-shield rings at both ends
    for (const zPos of [-0.47, 0.12]) {
      const ringGeo = new THREE.CylinderGeometry(0.068, 0.068, 0.045, 16);
      ringGeo.rotateX(Math.PI / 2);
      const ring = new THREE.Mesh(ringGeo, this.darkSteelMat!);
      ring.position.set(0, 0.02, zPos);
      root.add(ring);
    }

    // Rocket warhead peeking out of the muzzle (armed & visible)
    const warheadGeo = new THREE.ConeGeometry(0.045, 0.14, 14);
    warheadGeo.rotateX(-Math.PI / 2);
    const warheadMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.4, metalness: 0.5 });
    const warhead = new THREE.Mesh(warheadGeo, warheadMat);
    warhead.position.set(0, 0.02, -0.53);
    root.add(warhead);

    // Rear exhaust bell (backblast area)
    const bellGeo = new THREE.CylinderGeometry(0.075, 0.05, 0.09, 16, 1, true);
    bellGeo.rotateX(Math.PI / 2);
    const bell = new THREE.Mesh(bellGeo, this.darkSteelMat!);
    bell.position.set(0, 0.02, 0.17);
    root.add(bell);

    // Optical sight rail + reflex sight block
    const railGeo = new THREE.BoxGeometry(0.03, 0.02, 0.3);
    const rail = new THREE.Mesh(railGeo, this.darkSteelMat!);
    rail.position.set(0, 0.085, -0.12);
    root.add(rail);
    const sightGeo = new THREE.BoxGeometry(0.05, 0.055, 0.09);
    const sight = new THREE.Mesh(sightGeo, this.tacticalGripMat!);
    sight.position.set(0, 0.12, -0.16);
    root.add(sight);
    const lensGeo = new THREE.CircleGeometry(0.018, 12);
    const lens = new THREE.Mesh(lensGeo, this.holoGlassMat!);
    lens.position.set(0, 0.128, -0.115);
    root.add(lens);

    // Forward grip & pistol grip
    const fGripGeo = new THREE.BoxGeometry(0.036, 0.1, 0.05);
    const fGrip = new THREE.Mesh(fGripGeo, this.tacticalGripMat!);
    fGrip.position.set(0, -0.07, -0.3);
    root.add(fGrip);
    const pGripGeo = new THREE.BoxGeometry(0.04, 0.12, 0.06);
    pGripGeo.rotateX(0.3);
    const pGrip = new THREE.Mesh(pGripGeo, this.tacticalGripMat!);
    pGrip.position.set(0, -0.08, 0.02);
    root.add(pGrip);

    // Stenciled hazard stripes on the tube
    for (let i = 0; i < 3; i++) {
      const stripeGeo = new THREE.BoxGeometry(0.062, 0.014, 0.05);
      const stripe = new THREE.Mesh(stripeGeo, new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 }));
      stripe.position.set(0, 0.02, -0.32 + i * 0.075);
      root.add(stripe);
    }

    return root;
  }

  // ==========================================
  // 8. ONI KATANA (folded-steel field blade)
  // ==========================================
  private static createKatana(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'gun_geometry';

    // Bright folded-steel blade (three angled segments for the signature curve)
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xc8ccd4,
      metalness: 0.98,
      roughness: 0.12,
    });
    let z = -0.18;
    let tilt = 0;
    const segLengths = [0.3, 0.3, 0.28];
    for (const len of segLengths) {
      const segGeo = new THREE.BoxGeometry(0.014, 0.028, len);
      const seg = new THREE.Mesh(segGeo, bladeMat);
      seg.position.set(0, 0.02 + tilt * 0.09, z - len / 2);
      seg.rotation.x = tilt * 0.22;
      root.add(seg);
      z -= len * Math.cos(tilt * 0.22);
      tilt += 1;
    }

    // Hammer-forged edge highlight (thin bright strip along the blade)
    const edgeGeo = new THREE.BoxGeometry(0.006, 0.008, 0.82);
    const edge = new THREE.Mesh(edgeGeo, new THREE.MeshStandardMaterial({
      color: 0xffffff, metalness: 1.0, roughness: 0.05,
    }));
    edge.position.set(0, 0.008, -0.62);
    edge.rotation.x = 0.045;
    root.add(edge);

    // Tsuba (oval hand guard)
    const tsubaGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.008, 18);
    tsubaGeo.rotateX(Math.PI / 2);
    const tsubaMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, metalness: 0.9, roughness: 0.35 });
    const tsuba = new THREE.Mesh(tsubaGeo, tsubaMat);
    tsuba.position.set(0, 0.015, -0.13);
    root.add(tsuba);

    // Tsuka (handle) with ito wrap rings
    const tsukaGeo = new THREE.BoxGeometry(0.026, 0.034, 0.22);
    const tsuka = new THREE.Mesh(tsukaGeo, this.tacticalGripMat!);
    tsuka.position.set(0, 0.012, -0.005);
    root.add(tsuka);
    for (let i = 0; i < 5; i++) {
      const wrapGeo = new THREE.BoxGeometry(0.03, 0.038, 0.012);
      const wrap = new THREE.Mesh(wrapGeo, new THREE.MeshStandardMaterial({ color: 0x2f2f38, roughness: 0.9 }));
      wrap.position.set(0, 0.012, 0.08 - i * 0.045);
      root.add(wrap);
    }

    // Kashira (pommel cap)
    const kashiraGeo = new THREE.BoxGeometry(0.03, 0.038, 0.02);
    const kashira = new THREE.Mesh(kashiraGeo, tsubaMat);
    kashira.position.set(0, 0.012, 0.105);
    root.add(kashira);

    // Blade gleam light catch — subtle emissive line down the spine
    const spineGeo = new THREE.BoxGeometry(0.004, 0.004, 0.8);
    const spine = new THREE.Mesh(spineGeo, new THREE.MeshBasicMaterial({ color: 0x8fb3c7, transparent: true, opacity: 0.35 }));
    spine.position.set(0, 0.036, -0.6);
    spine.rotation.x = 0.045;
    root.add(spine);

    // Held angled like a low guard stance
    root.rotation.z = -0.35;
    root.rotation.x = 0.18;

    return root;
  }

  // ==========================================
  // 9. ORDINANCE TABLET (Air Strike Designator)
  // ==========================================
  private static createAirstrikeTablet(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'gun_geometry';

    // Tactical tablet body - rugged military design
    const tabletGeo = new THREE.BoxGeometry(0.18, 0.012, 0.25);
    const tabletMat = new THREE.MeshStandardMaterial({
      color: 0x1a1f26,
      metalness: 0.7,
      roughness: 0.35,
    });
    const tablet = new THREE.Mesh(tabletGeo, tabletMat);
    tablet.position.set(0, 0.03, -0.02);
    root.add(tablet);

    // Reinforced corners
    for (const [x, z] of [[-0.08, -0.11], [0.08, -0.11], [-0.08, 0.11], [0.08, 0.11]]) {
      const cornerGeo = new THREE.BoxGeometry(0.02, 0.018, 0.02);
      const corner = new THREE.Mesh(cornerGeo, this.darkSteelMat!);
      corner.position.set(x, 0.03, z);
      root.add(corner);
    }

    // Screen area (dark glass)
    const screenGeo = new THREE.BoxGeometry(0.14, 0.01, 0.19);
    const screenMat = new THREE.MeshPhysicalMaterial({
      color: 0x0a1628,
      transmission: 0.2,
      opacity: 0.9,
      transparent: true,
      roughness: 0.05,
      ior: 1.52,
    });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 0.04, -0.02);
    root.add(screen);

    // Holographic map display on screen (emissive)
    const holoGeo = new THREE.BoxGeometry(0.13, 0.005, 0.18);
    const holoMat = new THREE.MeshBasicMaterial({
      color: 0x00ffaa,
      transparent: true,
      opacity: 0.4,
    });
    const holo = new THREE.Mesh(holoGeo, holoMat);
    holo.position.set(0, 0.043, -0.02);
    root.add(holo);

    // Target reticle on screen (pulsing)
    const reticleGeo = new THREE.RingGeometry(0.015, 0.025, 16);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const reticle = new THREE.Mesh(reticleGeo, reticleMat);
    reticle.position.set(0, 0.046, -0.02);
    reticle.rotation.x = -Math.PI / 2;
    root.add(reticle);

    // Antenna on top-right corner
    const antennaGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.12, 8);
    const antenna = new THREE.Mesh(antennaGeo, this.darkSteelMat!);
    antenna.position.set(0.07, 0.1, 0.09);
    root.add(antenna);
    // Antenna tip light
    const antTipGeo = new THREE.SphereGeometry(0.006, 8, 8);
    const antTipMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
    const antTip = new THREE.Mesh(antTipGeo, antTipMat);
    antTip.position.set(0.07, 0.165, 0.09);
    root.add(antTip);

    // Side grip/handle
    const gripGeo = new THREE.BoxGeometry(0.025, 0.11, 0.04);
    const grip = new THREE.Mesh(gripGeo, this.tacticalGripMat!);
    grip.position.set(-0.11, -0.02, -0.02);
    root.add(grip);

    // Strap attachment points
    for (const zPos of [-0.1, 0.1]) {
      const strapGeo = new THREE.TorusGeometry(0.012, 0.005, 6, 12);
      const strap = new THREE.Mesh(strapGeo, this.darkSteelMat!);
      strap.position.set(-0.11, -0.02, zPos);
      strap.rotation.x = Math.PI / 2;
      root.add(strap);
    }

    // Charge indicator LEDs (4 dots on side)
    for (let i = 0; i < 4; i++) {
      const ledGeo = new THREE.SphereGeometry(0.006, 8, 8);
      const ledMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa });
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(0.11, 0.02, -0.08 + i * 0.05);
      led.name = `charge_led_${i}`;
      root.add(led);
    }

    // Tactical carry handle on top
    const handleGeo = new THREE.TorusGeometry(0.025, 0.006, 8, 16);
    const handle = new THREE.Mesh(handleGeo, this.darkSteelMat!);
    handle.position.set(0, 0.06, -0.12);
    handle.rotation.x = Math.PI / 2;
    root.add(handle);

    // Emissive charge status line
    const chargeBarGeo = new THREE.BoxGeometry(0.1, 0.004, 0.01);
    const chargeBarMat = new THREE.MeshBasicMaterial({
      color: 0x00ffaa,
      transparent: true,
      opacity: 0.7,
    });
    const chargeBar = new THREE.Mesh(chargeBarGeo, chargeBarMat);
    chargeBar.position.set(0, 0.046, 0.11);
    chargeBar.name = 'charge_bar';
    root.add(chargeBar);

    // Held like a tablet - angled slightly down
    root.rotation.x = 0.15;
    root.rotation.z = 0.05;

    return root;
  }

  // ==========================================
  // 1. TACTICAL COMBAT PISTOL (9mm Custom)
  // ==========================================
  private static createPistol(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'gun_geometry';

    // Slide with serrations & ejection port
    const slideGeo = new THREE.BoxGeometry(0.046, 0.052, 0.23);
    const slide = new THREE.Mesh(slideGeo, this.gunMetalMat!);
    slide.position.set(0, 0.045, -0.02);
    root.add(slide);

    // Ejection port chamber cutout
    const chamberGeo = new THREE.BoxGeometry(0.024, 0.02, 0.05);
    const chamber = new THREE.Mesh(chamberGeo, this.darkSteelMat!);
    chamber.position.set(0.015, 0.065, 0.01);
    root.add(chamber);

    // Visible brass casing top in chamber
    const brassGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.024, 8);
    brassGeo.rotateZ(Math.PI / 2);
    const brass = new THREE.Mesh(brassGeo, this.brassMat!);
    brass.position.set(0.01, 0.06, 0.01);
    root.add(brass);

    // Threaded barrel
    const barrelGeo = new THREE.CylinderGeometry(0.013, 0.013, 0.09, 12);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, this.darkSteelMat!);
    barrel.position.set(0, 0.045, -0.135);
    root.add(barrel);

    // Polymer lower frame
    const frameGeo = new THREE.BoxGeometry(0.042, 0.038, 0.19);
    const frame = new THREE.Mesh(frameGeo, this.tacticalGripMat!);
    frame.position.set(0, 0.008, -0.01);
    root.add(frame);

    // Ergonomic stippled grip
    const gripGeo = new THREE.BoxGeometry(0.039, 0.125, 0.06);
    gripGeo.rotateX(0.24);
    const grip = new THREE.Mesh(gripGeo, this.tacticalGripMat!);
    grip.position.set(0, -0.058, 0.05);
    root.add(grip);

    // Trigger guard & skeletonized trigger
    const guardGeo = new THREE.TorusGeometry(0.022, 0.004, 6, 12, Math.PI);
    guardGeo.rotateX(Math.PI / 2);
    guardGeo.rotateY(Math.PI / 2);
    const guard = new THREE.Mesh(guardGeo, this.darkSteelMat!);
    guard.position.set(0, -0.022, -0.01);
    root.add(guard);

    // Underbarrel Tactical Laser Module
    const laserBoxGeo = new THREE.BoxGeometry(0.028, 0.024, 0.07);
    const laserBox = new THREE.Mesh(laserBoxGeo, this.darkSteelMat!);
    laserBox.position.set(0, -0.015, -0.075);
    root.add(laserBox);

    // Emitted Laser Beam Line
    const laserLineGeo = new THREE.CylinderGeometry(0.0015, 0.0015, 12, 5);
    laserLineGeo.rotateX(Math.PI / 2);
    const laserLine = new THREE.Mesh(laserLineGeo, this.laserBeamMat!);
    laserLine.position.set(0, -0.015, -6.1);
    root.add(laserLine);

    // High-visibility green tritium iron sights
    const frontSightGeo = new THREE.BoxGeometry(0.006, 0.014, 0.012);
    const frontSight = new THREE.Mesh(frontSightGeo, this.holoDotMat!);
    frontSight.position.set(0, 0.075, -0.12);
    root.add(frontSight);

    return root;
  }

  // ==========================================
  // 2. TACTICAL 12-GAUGE BREACHING SHOTGUN
  // ==========================================
  private static createShotgun(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'gun_geometry';

    // Heavy milled receiver
    const recGeo = new THREE.BoxGeometry(0.058, 0.075, 0.28);
    const rec = new THREE.Mesh(recGeo, this.darkSteelMat!);
    rec.position.set(0, 0.025, 0.02);
    root.add(rec);

    // Top Picatinny Rail
    for (let i = 0; i < 7; i++) {
      const railGeo = new THREE.BoxGeometry(0.035, 0.006, 0.015);
      const rail = new THREE.Mesh(railGeo, this.gunMetalMat!);
      rail.position.set(0, 0.066, -0.07 + i * 0.022);
      root.add(rail);
    }

    // Heavy main 12ga barrel + breaching muzzle teeth
    const barrelGeo = new THREE.CylinderGeometry(0.017, 0.017, 0.48, 14);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, this.gunMetalMat!);
    barrel.position.set(0, 0.045, -0.24);
    root.add(barrel);

    // Underbarrel magazine tube
    const tubeGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.42, 14);
    tubeGeo.rotateX(Math.PI / 2);
    const tube = new THREE.Mesh(tubeGeo, this.darkSteelMat!);
    tube.position.set(0, 0.012, -0.21);
    root.add(tube);

    // Ribbed tactical forend pump
    const pumpGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.16, 12);
    pumpGeo.rotateX(Math.PI / 2);
    const pump = new THREE.Mesh(pumpGeo, this.tacticalGripMat!);
    pump.position.set(0, 0.012, -0.19);
    root.add(pump);

    // Side shell carrier with red 12-gauge shells
    for (let s = 0; s < 4; s++) {
      const shellGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.05, 10);
      const shellMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 });
      const shell = new THREE.Mesh(shellGeo, shellMat);
      shell.position.set(0.038, 0.025, -0.05 + s * 0.028);
      root.add(shell);
    }

    // Pistol grip & skeletonized tactical stock
    const gripGeo = new THREE.BoxGeometry(0.044, 0.13, 0.065);
    gripGeo.rotateX(0.28);
    const grip = new THREE.Mesh(gripGeo, this.tacticalGripMat!);
    grip.position.set(0, -0.065, 0.11);
    root.add(grip);

    // Stock tube & cheek rest
    const stockGeo = new THREE.BoxGeometry(0.042, 0.07, 0.24);
    const stock = new THREE.Mesh(stockGeo, this.tacticalGripMat!);
    stock.position.set(0, 0.02, 0.26);
    root.add(stock);

    return root;
  }

  // ==========================================
  // 3. M4A1 TACTICAL ASSAULT RIFLE
  // ==========================================
  private static createRifle(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'gun_geometry';

    // Upper and lower forged receiver
    const upperGeo = new THREE.BoxGeometry(0.052, 0.07, 0.34);
    const upper = new THREE.Mesh(upperGeo, this.gunMetalMat!);
    upper.position.set(0, 0.032, -0.02);
    root.add(upper);

    // Brass deflector & Forward assist
    const deflectorGeo = new THREE.BoxGeometry(0.02, 0.025, 0.03);
    const deflector = new THREE.Mesh(deflectorGeo, this.darkSteelMat!);
    deflector.position.set(0.032, 0.045, 0.06);
    root.add(deflector);

    // Free-float M-LOK Handguard
    const handguardGeo = new THREE.BoxGeometry(0.048, 0.058, 0.3);
    const handguard = new THREE.Mesh(handguardGeo, this.darkSteelMat!);
    handguard.position.set(0, 0.032, -0.28);
    root.add(handguard);

    // Mil-spec barrel with birdcage flash hider
    const barrelGeo = new THREE.CylinderGeometry(0.013, 0.013, 0.24, 12);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, this.darkSteelMat!);
    barrel.position.set(0, 0.032, -0.48);
    root.add(barrel);

    // Flash hider slots
    const flashGeo = new THREE.CylinderGeometry(0.017, 0.017, 0.055, 8);
    flashGeo.rotateX(Math.PI / 2);
    const flashHider = new THREE.Mesh(flashGeo, this.gunMetalMat!);
    flashHider.position.set(0, 0.032, -0.61);
    root.add(flashHider);

    // Curved PMAG 30-round magazine with grip ribs
    const magGeo = new THREE.BoxGeometry(0.036, 0.16, 0.065);
    magGeo.rotateX(-0.24);
    const mag = new THREE.Mesh(magGeo, this.darkSteelMat!);
    mag.position.set(0, -0.088, -0.06);
    root.add(mag);

    // Angled Tactical Foregrip
    const fgripGeo = new THREE.BoxGeometry(0.035, 0.07, 0.08);
    fgripGeo.rotateX(-0.35);
    const fgrip = new THREE.Mesh(fgripGeo, this.tacticalGripMat!);
    fgrip.position.set(0, -0.025, -0.26);
    root.add(fgrip);

    // Holographic EOTech Sight
    const holoHoodGeo = new THREE.BoxGeometry(0.044, 0.048, 0.085);
    const holoHood = new THREE.Mesh(holoHoodGeo, this.darkSteelMat!);
    holoHood.position.set(0, 0.09, -0.06);
    root.add(holoHood);

    const holoGlassGeo = new THREE.PlaneGeometry(0.034, 0.034);
    const holoGlass = new THREE.Mesh(holoGlassGeo, this.holoGlassMat!);
    holoGlass.position.set(0, 0.09, -0.06);
    root.add(holoGlass);

    // Glowing Red Circular Reticle + Center Dot
    const reticleRing = new THREE.Mesh(new THREE.RingGeometry(0.005, 0.007, 16), this.holoDotMat!);
    reticleRing.position.set(0, 0.09, -0.062);
    const reticleDot = new THREE.Mesh(new THREE.CircleGeometry(0.0018, 8), this.holoDotMat!);
    reticleDot.position.set(0, 0.09, -0.062);
    root.add(reticleRing, reticleDot);

    // Laser sight attached to rail
    const laserGeo = new THREE.BoxGeometry(0.024, 0.024, 0.08);
    const laserUnit = new THREE.Mesh(laserGeo, this.darkSteelMat!);
    laserUnit.position.set(0.032, 0.04, -0.22);
    root.add(laserUnit);

    const laserLineGeo = new THREE.CylinderGeometry(0.0015, 0.0015, 12, 5);
    laserLineGeo.rotateX(Math.PI / 2);
    const laserLine = new THREE.Mesh(laserLineGeo, this.laserBeamMat!);
    laserLine.position.set(0.032, 0.04, -6.3);
    root.add(laserLine);

    // Ergonomic Pistol Grip
    const gripGeo = new THREE.BoxGeometry(0.04, 0.125, 0.055);
    gripGeo.rotateX(0.26);
    const grip = new THREE.Mesh(gripGeo, this.tacticalGripMat!);
    grip.position.set(0, -0.065, 0.09);
    root.add(grip);

    return root;
  }

  // ==========================================
  // 4. VECTOR / MPX SUBMACHINE GUN
  // ==========================================
  private static createSMG(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'gun_geometry';

    // Compact futuristic receiver
    const bodyGeo = new THREE.BoxGeometry(0.048, 0.095, 0.26);
    const body = new THREE.Mesh(bodyGeo, this.gunMetalMat!);
    body.position.set(0, 0.022, 0.0);
    root.add(body);

    // Suppressor barrel shroud
    const supGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.2, 14);
    supGeo.rotateX(Math.PI / 2);
    const sup = new THREE.Mesh(supGeo, this.darkSteelMat!);
    sup.position.set(0, 0.042, -0.22);
    root.add(sup);

    // Extended 33-round stick magazine
    const magGeo = new THREE.BoxGeometry(0.032, 0.18, 0.042);
    magGeo.rotateX(0.18);
    const mag = new THREE.Mesh(magGeo, this.darkSteelMat!);
    mag.position.set(0, -0.1, -0.04);
    root.add(mag);

    // Vertical stubby foregrip
    const fgripGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.1, 10);
    const fgrip = new THREE.Mesh(fgripGeo, this.tacticalGripMat!);
    fgrip.position.set(0, -0.045, -0.14);
    root.add(fgrip);

    // Micro Red Dot Sight
    const reflexGeo = new THREE.BoxGeometry(0.036, 0.038, 0.055);
    const reflex = new THREE.Mesh(reflexGeo, this.tacticalGripMat!);
    reflex.position.set(0, 0.088, -0.02);
    root.add(reflex);

    const redDot = new THREE.Mesh(new THREE.CircleGeometry(0.0025, 8), this.holoDotMat!);
    redDot.position.set(0, 0.088, -0.022);
    root.add(redDot);

    return root;
  }

  // ==========================================
  // 5. M249 SQUAD AUTOMATIC WEAPON (HEAVY MG)
  // ==========================================
  private static createHeavy(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'gun_geometry';

    // High-poly authored model when available (streams in the background)
    const gltfGun = HeavyWeaponModel.getGroup();
    if (gltfGun) {
      root.add(gltfGun);
      return root;
    }

    // Massive steel receiver
    const blockGeo = new THREE.BoxGeometry(0.088, 0.11, 0.42);
    const block = new THREE.Mesh(blockGeo, this.gunMetalMat!);
    block.position.set(0, 0.035, 0.02);
    root.add(block);

    // Heavy fluted double-barrel cooling jacket with vent holes
    const barrelGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.38, 14);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, this.darkSteelMat!);
    barrel.position.set(0, 0.045, -0.34);
    root.add(barrel);

    // 100-round side drum magazine
    const drumGeo = new THREE.CylinderGeometry(0.068, 0.068, 0.11, 18);
    drumGeo.rotateZ(Math.PI / 2);
    const drum = new THREE.Mesh(drumGeo, this.darkSteelMat!);
    drum.position.set(-0.075, -0.025, 0.03);
    root.add(drum);

    // Visible linked 5.56 brass ammo belt feeding into receiver
    for (let b = 0; b < 5; b++) {
      const roundGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.032, 8);
      const round = new THREE.Mesh(roundGeo, this.brassMat!);
      round.position.set(-0.045 + b * 0.009, 0.04, -0.02 + b * 0.006);
      round.rotation.z = Math.PI / 3;
      root.add(round);
    }

    // Heavy carry handle
    const handleGeo = new THREE.BoxGeometry(0.022, 0.045, 0.19);
    const handle = new THREE.Mesh(handleGeo, this.tacticalGripMat!);
    handle.position.set(0, 0.115, -0.02);
    root.add(handle);

    return root;
  }

  // ==========================================
  // 6. .50 CAL LONG-RANGE ANTI-MATERIEL SNIPER
  // ==========================================
  private static createSniper(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'gun_geometry';

    // Precision chassis & bolt handle
    const chassisGeo = new THREE.BoxGeometry(0.052, 0.065, 0.48);
    const chassis = new THREE.Mesh(chassisGeo, this.tacticalGripMat!);
    chassis.position.set(0, 0.015, 0.05);
    root.add(chassis);

    // Bolt action handle knob
    const boltKnob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), this.darkSteelMat!);
    boltKnob.position.set(0.045, 0.04, 0.08);
    root.add(boltKnob);

    // Heavy fluted match-grade barrel
    const barrelGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.62, 14);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, this.darkSteelMat!);
    barrel.position.set(0, 0.035, -0.46);
    root.add(barrel);

    // Double-baffle muzzle brake
    const brakeGeo = new THREE.BoxGeometry(0.038, 0.038, 0.08);
    const brake = new THREE.Mesh(brakeGeo, this.gunMetalMat!);
    brake.position.set(0, 0.035, -0.8);
    root.add(brake);

    // High-magnification 8-24x tactical sniper scope
    const scopeGeo = new THREE.CylinderGeometry(0.025, 0.028, 0.25, 16);
    scopeGeo.rotateX(Math.PI / 2);
    const scope = new THREE.Mesh(scopeGeo, this.darkSteelMat!);
    scope.position.set(0, 0.09, -0.02);
    root.add(scope);

    // Elevation & Windage adjustment turrets
    const turretGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.02, 10);
    const topTurret = new THREE.Mesh(turretGeo, this.gunMetalMat!);
    topTurret.position.set(0, 0.12, -0.02);
    const sideTurret = new THREE.Mesh(turretGeo, this.gunMetalMat!);
    sideTurret.rotateZ(Math.PI / 2);
    sideTurret.position.set(0.03, 0.09, -0.02);
    root.add(topTurret, sideTurret);

    // Scope rear eye lens
    const lensGeo = new THREE.CircleGeometry(0.023, 16);
    const lens = new THREE.Mesh(lensGeo, this.holoGlassMat!);
    lens.position.set(0, 0.09, 0.106);
    root.add(lens);

    return root;
  }

  // ==========================================
  // OPERATOR HANDS, CARBON KNUCKLES & FATIGUES
  // ==========================================
  private static createHandsAndArms(type: WeaponTypeKey): THREE.Group {
    const armsGroup = new THREE.Group();
    armsGroup.name = 'first_person_arms';

    // Right Arm (Trigger arm)
    const rightArmGeo = new THREE.CylinderGeometry(0.048, 0.058, 0.38, 12);
    rightArmGeo.rotateX(-0.8);
    rightArmGeo.rotateY(0.2);
    const rightArm = new THREE.Mesh(rightArmGeo, this.sleeveMat!);
    rightArm.position.set(0.085, -0.23, 0.17);
    armsGroup.add(rightArm);

    // Right Hand (Glove palm & fingers)
    const rightHandGroup = new THREE.Group();
    rightHandGroup.position.set(0.012, -0.065, 0.08);

    const rightGloveGeo = new THREE.BoxGeometry(0.058, 0.068, 0.082);
    const rightGlove = new THREE.Mesh(rightGloveGeo, this.gloveMat!);
    rightHandGroup.add(rightGlove);

    // Molded Carbon-Fiber Knuckle Guard
    const knuckleGeo = new THREE.BoxGeometry(0.056, 0.022, 0.032);
    const rightKnuckle = new THREE.Mesh(knuckleGeo, this.knuckleMat!);
    rightKnuckle.position.set(0, 0.032, 0.015);
    rightHandGroup.add(rightKnuckle);

    armsGroup.add(rightHandGroup);

    // Left Arm (Support arm)
    const leftArmGeo = new THREE.CylinderGeometry(0.048, 0.058, 0.44, 12);
    leftArmGeo.rotateX(-0.7);
    leftArmGeo.rotateY(-0.4);
    const leftArm = new THREE.Mesh(leftArmGeo, this.sleeveMat!);
    leftArm.position.set(-0.17, -0.26, 0.09);
    armsGroup.add(leftArm);

    // Left Hand (Support glove)
    const leftHandGroup = new THREE.Group();
    if (type === 'pistol' || type === 'katana') {
      leftHandGroup.position.set(-0.012, -0.095, 0.06);
    } else if (type === 'rocket') {
      leftHandGroup.position.set(-0.005, -0.075, -0.31);
    } else {
      leftHandGroup.position.set(-0.02, -0.01, -0.2);
    }

    const leftGloveGeo = new THREE.BoxGeometry(0.054, 0.065, 0.078);
    const leftGlove = new THREE.Mesh(leftGloveGeo, this.gloveMat!);
    leftHandGroup.add(leftGlove);

    const leftKnuckle = new THREE.Mesh(knuckleGeo, this.knuckleMat!);
    leftKnuckle.position.set(0, 0.03, 0.015);
    leftHandGroup.add(leftKnuckle);

    armsGroup.add(leftHandGroup);

    return armsGroup;
  }
}
