import * as THREE from 'three';
import { GraphicsSettings } from '../core/GraphicsSettings';

/**
 * Atmospheric gradient sky dome with sun/moon disc and horizon haze.
 * Follows the camera so it always renders inside the far plane.
 * 
 * MOBILE OPTIMIZATION: On LOW preset, reduce geometry subdivisions and star count
 * to minimize vertex/fragment overhead.
 */
const SkyShader = {
  uniforms: {
    uTopColor: { value: new THREE.Color(0x1a2c4e) },
    uHorizonColor: { value: new THREE.Color(0x8cbfe8) },
    uGroundColor: { value: new THREE.Color(0x2a2e36) },
    uSunDirection: { value: new THREE.Vector3(0.4, 0.6, 0.2).normalize() },
    uSunColor: { value: new THREE.Color(0xfff2d0) },
    uSunIntensity: { value: 1.0 },
  },
  vertexShader: /* glsl */ `
    varying vec3 vWorldDirection;
    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldDirection = normalize(worldPos.xyz - cameraPosition);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uTopColor;
    uniform vec3 uHorizonColor;
    uniform vec3 uGroundColor;
    uniform vec3 uSunDirection;
    uniform vec3 uSunColor;
    uniform float uSunIntensity;
    varying vec3 vWorldDirection;

    void main() {
      vec3 dir = normalize(vWorldDirection);
      float h = dir.y;

      // Vertical gradient: horizon haze -> deep zenith
      float t = pow(clamp(h, 0.0, 1.0), 0.55);
      vec3 sky = mix(uHorizonColor, uTopColor, t);
      // Below horizon: darker ground haze so the dome never looks cut off
      sky = mix(sky, uGroundColor, smoothstep(0.0, -0.18, h));

      // Sun / moon disc with soft halo
      float sunDot = max(dot(dir, normalize(uSunDirection)), 0.0);
      float disc = smoothstep(0.9986, 0.9993, sunDot);
      float halo = pow(sunDot, 220.0) * 0.5 + pow(sunDot, 18.0) * 0.12;
      sky += uSunColor * (disc * 1.6 + halo) * uSunIntensity;

      gl_FragColor = vec4(sky, 1.0);
    }
  `,
};

export class SkyDome {
  private static mesh: THREE.Mesh | null = null;
  private static material: THREE.ShaderMaterial | null = null;
  private static stars: THREE.Points | null = null;

  public static init(scene: THREE.Scene) {
    if (this.mesh) return;

    // REDUCED geometry on LOW preset or any touch device (fewer vertices = less vertex shader work)
    const effects = GraphicsSettings.get().effectsQuality;
    const isTouch =
      'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;
    const isLow = effects === 'LOW' || isTouch;
    const geo = new THREE.SphereGeometry(210, isLow ? 16 : 32, isLow ? 10 : 20);
    
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(SkyShader.uniforms),
      vertexShader: SkyShader.vertexShader,
      fragmentShader: SkyShader.fragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.renderOrder = -1000;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    // REDUCED star count on LOW preset
    const starCount = isLow ? 120 : 420;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 360;
      positions[i * 3 + 1] = Math.random() * 150 + 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 360;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xdbeafe,
      size: 1.1,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      fog: false,
    });
    this.stars = new THREE.Points(starGeo, starMat);
    this.stars.frustumCulled = false;
    scene.add(this.stars);
  }

  /** Match sky mood to a mission environment's fog + light colors. */
  public static applyEnvironment(env: {
    fogColor: number;
    directionalColor: number;
    directionalPos: [number, number, number];
  }) {
    if (!this.material) return;
    const fog = new THREE.Color(env.fogColor);
    const uniforms = this.material.uniforms;

    (uniforms.uHorizonColor.value as THREE.Color).copy(fog);
    // Zenith: darker, slightly desaturated version of the fog color
    const top = fog.clone().multiplyScalar(0.34).lerp(new THREE.Color(0x101828), 0.42);
    (uniforms.uTopColor.value as THREE.Color).copy(top);
    (uniforms.uGroundColor.value as THREE.Color).copy(fog.clone().multiplyScalar(0.42));

    (uniforms.uSunDirection.value as THREE.Vector3)
      .set(env.directionalPos[0], env.directionalPos[1], env.directionalPos[2])
      .normalize();
    (uniforms.uSunColor.value as THREE.Color).set(env.directionalColor);

    // Stars only visible in dark night skies
    if (this.stars) {
      const luminance = fog.r * 0.3 + fog.g * 0.6 + fog.b * 0.1;
      const starMat = this.stars.material as THREE.PointsMaterial;
      starMat.opacity = luminance > 0.55 ? 0.0 : luminance > 0.35 ? 0.2 : 0.55;
      starMat.visible = starMat.opacity > 0.01;
    }
  }

  public static update(camera: THREE.Camera) {
    if (this.mesh) {
      this.mesh.position.copy(camera.position);
    }
    if (this.stars) {
      this.stars.position.copy(camera.position);
    }
  }

  public static dispose() {
    this.mesh?.removeFromParent();
    this.stars?.removeFromParent();
    this.mesh?.geometry.dispose();
    this.material?.dispose();
    (this.stars?.material as THREE.Material | undefined)?.dispose();
    this.stars?.geometry.dispose();
    this.mesh = null;
    this.stars = null;
    this.material = null;
  }

  /** Reinitialize sky dome geometry when graphics quality changes. */
  public static reinitGeometry(): void {
    if (!this.mesh) return;
    
    const effects = GraphicsSettings.get().effectsQuality;
    const isTouch =
      'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;
    const isLow = effects === 'LOW' || isTouch;
    
    // Dispose old
    this.mesh.geometry.dispose();
    if (this.stars) {
      this.stars.geometry.dispose();
      (this.stars.material as THREE.Material).dispose();
    }
    
    // Recreate with new subdivisions
    const geo = new THREE.SphereGeometry(210, isLow ? 16 : 32, isLow ? 10 : 20);
    this.mesh.geometry = geo;
    
    // Recreate stars
    const starCount = isLow ? 120 : 420;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 360;
      positions[i * 3 + 1] = Math.random() * 150 + 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 360;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.stars!.geometry = starGeo;
  }
}
