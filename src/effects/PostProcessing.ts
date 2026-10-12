import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * Cinematic post-processing stack:
 * HDR render -> UnrealBloom (emissive windows, muzzle flashes, fires, lasers)
 * -> ACES tonemap output -> SMAA -> film grade (vignette, chromatic aberration,
 * damage distortion, film grain, color grade).
 */
const CinematicGradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uDamage: { value: 0 },      // 0..1 fresh damage flash
    uLowHealth: { value: 0 },   // 0..1 sustained critical health pulse
    uAberration: { value: 0.0011 },
    uVignette: { value: 0.42 },
    uGrain: { value: 0.05 },
    uFlash: { value: 0 },       // muzzle / explosion screen micro-flash
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uDamage;
    uniform float uLowHealth;
    uniform float uAberration;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uFlash;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7)) + uTime) * 43758.5453);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float dist = length(centered);

      // Damage waves warp the screen slightly (concussion feel)
      float warp = uDamage * 0.012 + uLowHealth * 0.004;
      vec2 warpOffset = centered * sin(dist * 24.0 - uTime * 9.0) * warp;

      // Radial chromatic aberration, intensified by damage
      float ca = uAberration + uDamage * 0.006 + uLowHealth * 0.0015;
      vec2 dir = centered * ca;
      float r = texture2D(tDiffuse, vUv + warpOffset + dir).r;
      vec2 gb = texture2D(tDiffuse, vUv + warpOffset).gb;
      float b = texture2D(tDiffuse, vUv + warpOffset + dir * 2.0).b;
      vec3 color = vec3(r, gb.x, max(gb.y, b));

      // Cinematic color grade: gentle teal shadows / warm highlights, sat lift
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      vec3 shadowTint = vec3(0.92, 1.0, 1.06);
      vec3 highTint = vec3(1.05, 1.01, 0.94);
      color *= mix(shadowTint, highTint, smoothstep(0.0, 0.7, luma));
      color = mix(vec3(luma), color, 1.07);
      color = (color - 0.5) * 1.05 + 0.5; // mild contrast

      // Muzzle / explosion screen micro-flash
      color += uFlash * vec3(1.0, 0.92, 0.78) * (1.0 - smoothstep(0.0, 0.9, dist));

      // Vignette, tinted blood-red while hurt
      float vig = smoothstep(0.85, 0.28, dist);
      color *= mix(1.0 - uVignette * 0.55, 1.0, vig);
      vec3 hurtColor = vec3(0.32, 0.02, 0.02);
      float hurtEdge = smoothstep(0.32, 0.78, dist);
      float hurtPulse = uLowHealth * (0.55 + 0.45 * sin(uTime * 6.0));
      float hurt = max(uDamage * 0.85, hurtPulse) * hurtEdge;
      color = mix(color, hurtColor, hurt);

      // Animated film grain (kept subtle, luminance weighted)
      float g = (hash(vUv * vec2(1920.0, 1080.0)) - 0.5) * uGrain;
      color += g * (1.0 - luma * 0.6);

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,
};

export interface PostFXState {
  damage: number;     // 0..1, decaying fresh-damage intensity
  lowHealth: number;  // 0..1, sustained while HP critical
  flash: number;      // 0..1, brief screen flash (muzzle/explosion)
}

export class PostProcessing {
  private static composer: EffectComposer | null = null;
  private static renderer: THREE.WebGLRenderer | null = null;
  private static scene: THREE.Scene | null = null;
  private static camera: THREE.Camera | null = null;
  private static renderPass: RenderPass | null = null;
  private static bloomPass: UnrealBloomPass | null = null;
  private static gradePass: ShaderPass | null = null;
  private static enabled: boolean = true;
  private static bloomBoost: number = 0;

  public static init(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    quality: 'LOW' | 'MEDIUM' | 'HIGH'
  ) {
    this.dispose();
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    const w = renderer.domElement.clientWidth || window.innerWidth;
    const h = renderer.domElement.clientHeight || window.innerHeight;

    this.composer = new EffectComposer(renderer);
    this.composer.setSize(w, h);

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // Bloom operates on pre-tonemap linear HDR: threshold must sit above 1.0
    // so only true emissives (muzzle flashes, lit windows, fires) glow.
    // HIGH only: bloom is a multi-pass fullscreen kernel — far too heavy for
    // MEDIUM/mobile GPUs. (SMAA is omitted entirely: the renderer is created
    // with antialias:true, so a second AA pass is pure overdraw.)
    if (quality === 'HIGH') {
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.5, 1.12);
      this.composer.addPass(this.bloomPass);
    }

    this.composer.addPass(new OutputPass());

    this.gradePass = new ShaderPass(CinematicGradeShader);
    this.composer.addPass(this.gradePass);

    // Composer only on desktop HIGH. MEDIUM/LOW render direct to canvas: on a
    // mid-range mobile GPU the three fullscreen passes (HDR target + tonemap
    // blit + grade pass with 3-tap chromatic aberration) cost more fragment
    // fill than the scene itself. Mobile HIGH also renders direct — phones
    // spend their budget on resolution instead (see getRenderPixelRatio in
    // App.tsx). Damage/low-health feedback on those tiers comes from the
    // HUD's red overlay instead of the shader grade.
    const isTouch =
      'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;
    this.enabled = quality === 'HIGH' && !isTouch;
  }

  public static setQuality(quality: 'LOW' | 'MEDIUM' | 'HIGH') {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.init(this.renderer, this.scene, this.camera, quality);
  }

  public static setSize(w: number, h: number) {
    if (!this.composer || !this.renderer) return;
    // Re-sync with any adaptive pixel-ratio changes made on the renderer
    // (dynamic resolution scaling) before resizing the render targets.
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
  }

  /** Swap the rendered camera (e.g. Air Strike bird's-eye targeting view). */
  public static setCamera(camera: THREE.Camera) {
    if (this.renderPass) {
      this.renderPass.camera = camera;
    }
    this.camera = camera;
  }

  /** Punch bloom when a muzzle flash or explosion lights up the frame. */
  public static punchBloom(amount: number = 0.5) {
    this.bloomBoost = Math.min(1.2, this.bloomBoost + amount);
  }

  public static render(delta: number, state: PostFXState) {
    if (!this.composer || !this.enabled || !this.gradePass) {
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
      return;
    }

    const u = this.gradePass.uniforms;
    u.uTime.value = performance.now() * 0.001;
    u.uDamage.value = THREE.MathUtils.clamp(state.damage, 0, 1);
    u.uLowHealth.value = THREE.MathUtils.clamp(state.lowHealth, 0, 1);
    u.uFlash.value = THREE.MathUtils.clamp(state.flash, 0, 1);

    if (this.bloomPass) {
      this.bloomBoost = Math.max(0, this.bloomBoost - delta * 5.0);
      this.bloomPass.strength = 0.55 + this.bloomBoost;
    }

    this.composer.render(delta);
  }

  public static dispose() {
    this.composer?.dispose();
    this.composer = null;
    this.renderPass = null;
    this.bloomPass = null;
    this.gradePass = null;
  }
}
