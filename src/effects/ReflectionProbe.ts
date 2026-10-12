import * as THREE from 'three';

/**
 * Sky-matched reflection probe. Replaces the studio RoomEnvironment whose
 * bright light panels showed up as hard white streaks on every metal and
 * glossy surface. Instead, a tiny gradient-sky scene (horizon = map fog
 * color, zenith darker, plus an HDR sun disc at the directional light's
 * direction) is PMREM-baked once per mission load, so specular reflections
 * always match the world's actual sky and mood.
 */
export class ReflectionProbe {
  private static pmrem: THREE.PMREMGenerator | null = null;
  private static currentRT: THREE.WebGLRenderTarget | null = null;

  public static init(renderer: THREE.WebGLRenderer) {
    if (!this.pmrem) {
      this.pmrem = new THREE.PMREMGenerator(renderer);
    }
  }

  public static applyEnvironment(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    env: {
      fogColor: number;
      directionalColor: number;
      directionalPos: [number, number, number];
    }
  ) {
    this.init(renderer);
    if (!this.pmrem) return;

    const fog = new THREE.Color(env.fogColor);
    const probeScene = new THREE.Scene();

    // Gradient sky shell
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const zenith = fog.clone().multiplyScalar(0.3).lerp(new THREE.Color(0x0c1220), 0.45);
    const belowHorizon = fog.clone().multiplyScalar(0.4);
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, `#${zenith.getHexString()}`);      // up
    grad.addColorStop(0.48, `#${fog.getHexString()}`);        // horizon
    grad.addColorStop(0.52, `#${belowHorizon.getHexString()}`); // below horizon
    grad.addColorStop(1.0, `#${belowHorizon.getHexString()}`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 256);

    const skyTex = new THREE.CanvasTexture(canvas);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(50, 24, 16),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide })
    );
    probeScene.add(skyDome);

    // HDR sun disc at the mission's light direction — gives metals one
    // coherent hot specular highlight instead of random white panels
    const sunDir = new THREE.Vector3(
      env.directionalPos[0],
      env.directionalPos[1],
      env.directionalPos[2]
    ).normalize();
    const sunColor = new THREE.Color(env.directionalColor).multiplyScalar(5.0);
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(3.4, 16, 12),
      new THREE.MeshBasicMaterial({ color: sunColor })
    );
    sun.position.copy(sunDir).multiplyScalar(45);
    probeScene.add(sun);

    const rt = this.pmrem.fromScene(probeScene, 0.04);
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.5;

    if (this.currentRT) {
      this.currentRT.dispose();
    }
    this.currentRT = rt;

    skyDome.geometry.dispose();
    (skyDome.material as THREE.Material).dispose();
    skyTex.dispose();
    sun.geometry.dispose();
    (sun.material as THREE.Material).dispose();
  }

  public static dispose() {
    if (this.currentRT) {
      this.currentRT.dispose();
      this.currentRT = null;
    }
    if (this.pmrem) {
      this.pmrem.dispose();
      this.pmrem = null;
    }
  }
}
