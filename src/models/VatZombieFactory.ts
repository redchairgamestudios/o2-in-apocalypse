import * as THREE from 'three';
import { ZombieConfig, ZombieTypeKey } from '../types';
import { ZombieInstance } from './ZombieModel';
import { GltfZombieFactory } from './GltfZombieFactory';
import { GraphicsSettings } from '../core/GraphicsSettings';

/**
 * Vertex Animation Texture (VAT) system for baked skinned animations.
 * 
 * On LOW/MEDIUM presets (mobile), we replace per-instance AnimationMixer
 * with a single static mesh + vertex shader that reads vertex positions
 * from a texture atlas. This eliminates the single biggest CPU cost:
 * per-frame skinning + mixer evaluation for every zombie.
 * 
 * Baking pipeline (run offline or at load time):
 * 1. Load GLTF model with animations
 * 2. For each animation clip, sample vertex positions at fixed frame rate
 * 3. Pack into 2D texture atlas (frames × vertices)
 * 4. At runtime, shader samples texture based on time + animation state
 */

export interface VatTextureData {
  texture: THREE.DataTexture;
  frameCount: number;
  vertexCount: number;
  fps: number;
  clipName: string;
}

export interface VatAnimationSet {
  clips: Map<string, VatTextureData>;
  baseGeometry: THREE.BufferGeometry;
  bindPoseTexture: THREE.DataTexture;
  boneTexture?: THREE.DataTexture; // For skinning fallback
}

// Global VAT cache - shared across all zombies of the same type
const vatCache = new Map<string, VatAnimationSet>();

// Animation clips to bake (subset of full GLTF clips for mobile)
const VAT_CLIPS_TO_BAKE = [
  'idle01', 'walk01', 'walk02', 'run', 
  'attack01', 'damage', 'death', 'caution',
  'eat', 'on_all_four_A', 'on_all_four_eat'
];

// Baking configuration
const VAT_BAKE_FPS = 30;      // Frames per second to sample
const VAT_MAX_FRAMES = 120;   // Max frames per clip (4 seconds at 30fps)

/**
 * Check if VAT should be used based on graphics settings and device
 */
export function shouldUseVat(): boolean {
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;

  // VAT system is not fully implemented (vertex shader missing vertex ID attribute for texture sampling)
  // Disable on mobile to use procedural/GLTF zombies that render correctly
  if (isMobile) return false;

  // On desktop, VAT is also disabled until vertex ID attribute is implemented
  return false;
}

/**
 * Bake a single animation clip to a VAT texture
 */
function bakeAnimationClip(
  geometry: THREE.BufferGeometry,
  clip: THREE.AnimationClip,
  mixer: THREE.AnimationMixer,
  root: THREE.Object3D,
  clipName: string
): VatTextureData {
  const positionAttr = geometry.getAttribute('position');
  const vertexCount = positionAttr.count;
  const frameCount = Math.min(Math.ceil(clip.duration * VAT_BAKE_FPS), VAT_MAX_FRAMES);
  
  // Texture dimensions: width = vertices, height = frames
  // Each pixel stores 4 floats (RGBA) = 1 vertex position (x, y, z, 1)
  const width = vertexCount;
  const height = frameCount;
  
  const data = new Float32Array(width * height * 4);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  
  const originalPosition = positionAttr.array.slice();
  
  for (let frame = 0; frame < frameCount; frame++) {
    const time = frame / VAT_BAKE_FPS;
    mixer.setTime(time);
    mixer.update(0);
    root.updateMatrixWorld(true);
    
    // Get skinned vertex positions
    const skinnedPositions = new Float32Array(vertexCount * 3);
    geometry.getAttribute('position').array = skinnedPositions;
    root.updateMatrixWorld(true);
    
    // Sample at bind pose and store
    const position = geometry.getAttribute('position');
    for (let v = 0; v < vertexCount; v++) {
      const idx = (frame * width + v) * 4;
      const vIdx = v * 3;
      data[idx] = position.getX(v);
      data[idx + 1] = position.getY(v);
      data[idx + 2] = position.getZ(v);
      data[idx + 3] = 1.0;
    }
  }
  
  // Restore
  geometry.getAttribute('position').array = originalPosition;
  positionAttr.needsUpdate = true;
  action.stop();
  
  // Create texture
  const texture = new THREE.DataTexture(
    data,
    width,
    height,
    THREE.RGBAFormat,
    THREE.FloatType
  );
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  
  return {
    texture,
    frameCount,
    vertexCount,
    fps: VAT_BAKE_FPS,
    clipName,
  };
}

/**
 * Pre-bake all VAT animations for a zombie type
 * Call this once during loading screen
 */
export async function preloadVatAnimations(): Promise<void> {
  if (!GltfZombieFactory.ready) {
    await GltfZombieFactory.preload();
  }
  
  // Clone template to access geometry
  const template = GltfZombieFactory.getTemplate();
  if (!template) {
    console.warn('VAT: GLTF template not ready');
    return;
  }
  
  // Find the skinned mesh in the template
  let skinnedMesh: THREE.SkinnedMesh | null = null;
  template.traverse((obj) => {
    if (obj instanceof THREE.SkinnedMesh && !skinnedMesh) {
      skinnedMesh = obj;
    }
  });
  
  if (!skinnedMesh) {
    console.warn('VAT: No skinned mesh found in template');
    return;
  }
  
  const geometry = skinnedMesh.geometry.clone();
  const clips = GltfZombieFactory.getClips();
  const mixer = new THREE.AnimationMixer(skinnedMesh);
  
  const animSet: VatAnimationSet = {
    clips: new Map(),
    baseGeometry: geometry,
    bindPoseTexture: createBindPoseTexture(geometry),
  };
  
  // Bake each animation clip
  for (const clipName of VAT_CLIPS_TO_BAKE) {
    const clip = clips.find(c => c.name === clipName);
    if (!clip) continue;
    
    try {
      const vatData = bakeAnimationClip(geometry, clip, mixer, skinnedMesh, clipName);
      animSet.clips.set(clipName, vatData);
      console.info(`VAT: Baked ${clipName} (${vatData.frameCount} frames, ${vatData.vertexCount} verts)`);
    } catch (e) {
      console.warn(`VAT: Failed to bake ${clipName}:`, e);
    }
  }
  
  // Cache for all zombie types (they share the same base model)
  vatCache.set('zombie_de_goma', animSet);
  console.info('%cO²%c VAT animations pre-baked', 
    'background:#b91c1c;color:#fff;padding:1px 6px;border-radius:3px;font-weight:bold',
    'color:#aaa');
}

/**
 * Create bind pose texture for fallback / blending
 */
function createBindPoseTexture(geometry: THREE.BufferGeometry): THREE.DataTexture {
  const positionAttr = geometry.getAttribute('position');
  const vertexCount = positionAttr.count;
  const data = new Float32Array(vertexCount * 4);
  
  for (let v = 0; v < vertexCount; v++) {
    const idx = v * 4;
    data[idx] = positionAttr.getX(v);
    data[idx + 1] = positionAttr.getY(v);
    data[idx + 2] = positionAttr.getZ(v);
    data[idx + 3] = 1.0;
  }
  
  const texture = new THREE.DataTexture(
    data,
    vertexCount,
    1,
    THREE.RGBAFormat,
    THREE.FloatType
  );
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  
  return texture;
}

/**
 * VAT Shader Material - reads vertex positions from texture atlas
 * Uses a single active texture uniform (swapped per clip) for WebGL1 compatibility
 */
export function createVatMaterial(animSet: VatAnimationSet): THREE.ShaderMaterial {
  // Get first texture as default
  const firstClip = animSet.clips.values().next().value;
  const defaultTexture = firstClip ? firstClip.texture : animSet.bindPoseTexture;
  
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFrameIndex: { value: 0 },
      uFrameBlend: { value: 0 },
      uFrameCount: { value: firstClip ? firstClip.frameCount : 1 },
      uVatTexture: { value: defaultTexture },
      uBindPoseTexture: { value: animSet.bindPoseTexture },
      uTextureWidth: { value: animSet.baseGeometry.getAttribute('position').count },
      uFps: { value: VAT_BAKE_FPS },
      uColor: { value: new THREE.Color(0xffffff) },
      uRoughness: { value: 0.62 },
      uMetalness: { value: 0.02 },
      uDamage: { value: 0 },
      uDecapitated: { value: 0 },
      uSeveredLimbs: { value: new THREE.Vector4(0, 0, 0, 0) }, // ARM_L, ARM_R, LEG_L, LEG_R
      uFlash: { value: 0 }, // hit flash
      uHeadBoneScale: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 position;
      attribute vec3 normal;
      attribute vec2 uv;
      
      uniform float uTime;
      uniform float uFrameIndex;
      uniform float uFrameBlend;
      uniform float uFrameCount;
      uniform sampler2D uVatTexture;
      uniform sampler2D uBindPoseTexture;
      uniform float uTextureWidth;
      uniform float uFps;
      uniform float uDamage;
      uniform float uDecapitated;
      uniform vec4 uSeveredLimbs;
      uniform float uFlash;
      uniform float uHeadBoneScale;
      
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying float vDamage;
      varying float vFlash;
      
      void main() {
        vUv = uv;
        vNormal = normalMatrix * normal;
        vDamage = uDamage;
        vFlash = uFlash;
        
        // Vertex ID (requires WebGL2 + #version 300 es)
        // For WebGL1 compat, we use a vertex attribute
        // float vertexId = float(gl_VertexID);
        
        // Compute frame index with blending
        float frame = mod(uFrameIndex, uFrameCount);
        float nextFrame = mod(frame + 1.0, uFrameCount);
        
        // We need vertex ID - pass as attribute in real implementation
        // For now, use position as fallback (won't animate correctly but renders)
        // In production, add: attribute float vertexId;
        
        // Sample VAT texture
        // Texture coords: x = vertexId / width, y = frame / frameCount
        // vec2 texCoord = vec2((vertexId + 0.5) / uTextureWidth, (frame + 0.5) / uFrameCount);
        // vec2 nextTexCoord = vec2((vertexId + 0.5) / uTextureWidth, (nextFrame + 0.5) / uFrameCount);
        // vec4 pos = texture2D(uVatTexture, texCoord);
        // vec4 nextPos = texture2D(uVatTexture, nextTexCoord);
        // vec4 blendedPos = mix(pos, nextPos, uFrameBlend);
        
        // Fallback: use bind pose with simple procedural animation
        vec4 blendedPos = vec4(position, 1.0);
        
        // Simple procedural head bob for VAT fallback
        float headMask = smoothstep(1.3, 1.8, position.y);
        blendedPos.y += sin(uTime * 4.0 + position.x * 10.0) * 0.02 * headMask;
        
        // Head scaling for decapitation
        if (uDecapitated > 0.5 && position.y > 1.4) {
          blendedPos.xyz *= uHeadBoneScale;
        }
        
        vec3 worldPos = (modelMatrix * blendedPos).xyz;
        vWorldPos = worldPos;
        
        gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uRoughness;
      uniform float uMetalness;
      uniform float uDamage;
      uniform float uFlash;
      
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying float vDamage;
      varying float vFlash;
      
      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        
        // Simple PBR-ish lighting
        vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
        float NdotL = max(dot(normal, lightDir), 0.0);
        
        vec3 diffuse = uColor * NdotL * 1.5;
        vec3 ambient = uColor * 0.3;
        
        // Damage flash
        vec3 color = mix(ambient + diffuse, vec3(1.0, 0.2, 0.1), vDamage);
        color = mix(color, vec3(1.0, 0.9, 0.7), vFlash * 0.5);
        
        // Vignette
        vec2 screenUv = gl_FragCoord.xy / vec2(1920.0, 1080.0);
        float vig = smoothstep(0.8, 0.3, length(screenUv - 0.5));
        color *= vig;
        
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    skinning: false,
    morphTargets: false,
  });
}

/**
 * Create a VAT zombie instance (static mesh + VAT material)
 */
export function createVatZombie(
  type: ZombieTypeKey,
  id: string,
  config: ZombieConfig
): { mesh: THREE.Mesh; hitboxMeshes: THREE.Object3D[]; vatData: any } | null {
  const animSet = vatCache.get('zombie_de_goma');
  if (!animSet || animSet.clips.size === 0) {
    return null; // VAT not ready, fall back to procedural
  }
  
  const material = createVatMaterial(animSet);
  
  // Apply tint
  const tintHex = new THREE.Color(config.skinColor || 0xffffff)
    .lerp(new THREE.Color(0xffffff), 0.45)
    .getHex();
  material.uniforms.uColor.value.setHex(tintHex);
  
  // Use base geometry (bind pose)
  const geometry = animSet.baseGeometry.clone();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `vat_zombie_${id}`;
  mesh.castShadow = false; // No shadows on VAT zombies (mobile)
  mesh.frustumCulled = false; // Animation moves vertices beyond bounds
  
  // Create simple hitboxes (capsules/spheres at bone positions in bind pose)
  const hitboxMeshes: THREE.Object3D[] = [];
  const addHitbox = (name: string, radius: number, position: THREE.Vector3, zone: string) => {
    const geo = new THREE.SphereGeometry(radius, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ visible: false });
    const hb = new THREE.Mesh(geo, mat);
    hb.position.copy(position);
    hb.userData = { zombieId: id, hitZone: zone };
    hitboxMeshes.push(hb);
    mesh.add(hb);
  };
  
  // Approximate hitbox positions (bind pose)
  const scale = config.scale || 1.0;
  addHitbox('head', 0.15 * scale, new THREE.Vector3(0, 1.6, 0.1), 'HEAD');
  addHitbox('torso', 0.22 * scale, new THREE.Vector3(0, 1.1, 0), 'TORSO');
  addHitbox('arm_l', 0.1 * scale, new THREE.Vector3(-0.35, 1.0, 0), 'LIMB');
  addHitbox('arm_r', 0.1 * scale, new THREE.Vector3(0.35, 1.0, 0), 'LIMB');
  addHitbox('leg_l', 0.12 * scale, new THREE.Vector3(-0.15, 0.5, 0), 'LIMB');
  addHitbox('leg_r', 0.12 * scale, new THREE.Vector3(0.15, 0.5, 0), 'LIMB');
  
  // Glowing eyes
  const eyeMat = new THREE.MeshBasicMaterial({ 
    color: new THREE.Color(config.eyeGlowColor || 0xffaa00).multiplyScalar(2.4) 
  });
  const eyeGeo = new THREE.SphereGeometry(0.028, 6, 5);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.07, 1.65, 0.12);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.07, 1.65, 0.12);
  mesh.add(eyeL, eyeR);
  
  // Weakpoint for bosses
  let weakpointMesh: THREE.Mesh | undefined;
  if (config.isBoss) {
    const wpMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3b1f).multiplyScalar(2.8) });
    const wp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), wpMat);
    wp.position.set(0, 1.2, 0.24);
    wp.userData = { zombieId: id, hitZone: 'WEAKPOINT' };
    hitboxMeshes.push(wp);
    mesh.add(wp);
    weakpointMesh = wp;
  }
  
  return {
    mesh,
    hitboxMeshes,
    vatData: {
      animSet,
      material,
      currentClip: 'idle01',
      frameIndex: 0,
      frameBlend: 0,
      timeScale: 1.0,
      loop: true,
    }
  };
}

/**
 * Update VAT zombie animation (called per-frame, very cheap)
 */
export function updateVatZombie(
  zombie: ZombieInstance,
  delta: number,
  distanceToPlayer: number
) {
  const vatData = (zombie as any).vatData;
  if (!vatData) return;
  
  // Defensive: ensure material and uniforms exist
  if (!vatData.material || !vatData.material.uniforms) {
    console.warn('[VAT] Missing material/uniforms, skipping update');
    return;
  }
  
  const { animSet, material, currentClip, frameIndex, frameBlend, timeScale, loop } = vatData;
  
  // Determine clip based on state (same logic as GltfZombieFactory)
  let clipName = 'idle01';
  let newTimeScale = 1.0;
  let newLoop = true;
  
  const isCrawler = zombie.type === 'crawler';
  const isFast = zombie.type === 'runner' || zombie.type === 'stalker' || zombie.isFrenzied;
  
  switch (zombie.state) {
    case 'IDLE':
      clipName = zombie.type === 'spitter' || zombie.type === 'bloater' ? 'eat' : 'idle01';
      newTimeScale = 0.9;
      break;
    case 'WANDER':
      clipName = 'walk01';
      newTimeScale = 0.75;
      break;
    case 'ALERT':
      clipName = 'caution';
      newTimeScale = 1.0;
      break;
    case 'STAGGER':
      clipName = 'damage';
      newTimeScale = 1.4;
      newLoop = false;
      break;
    case 'ATTACK':
      clipName = isCrawler ? 'on_all_four_eat' : 'attack01';
      newTimeScale = 1.25;
      break;
    case 'CHASE':
    default:
      if (isCrawler) {
        clipName = 'on_all_four_A';
        newTimeScale = 1.3;
      } else if (isFast) {
        clipName = 'run';
        newTimeScale = THREE.MathUtils.clamp(zombie.speed / 2.4, 0.85, 1.5);
      } else {
        clipName = 'walk02';
        newTimeScale = THREE.MathUtils.clamp(zombie.speed / 1.4, 0.8, 1.3);
      }
      break;
  }
  
  if (zombie.slowTimer > 0) {
    newTimeScale *= Math.max(0.35, zombie.slowMultiplier);
  }
  
  // Safe uniform setter to avoid "Cannot set properties of undefined"
  const setUniform = (name: string, value: number | THREE.Color) => {
    const uniform = material.uniforms[name];
    if (uniform && typeof uniform.value !== 'undefined') {
      uniform.value = value;
    }
  };
  
  // Crossfade logic
  if (clipName !== vatData.currentClip) {
    vatData.currentClip = clipName;
    vatData.frameIndex = 0;
    vatData.frameBlend = 0;
    vatData.timeScale = newTimeScale;
    vatData.loop = newLoop;
    
    const clipNames = Array.from(animSet.clips.keys());
    vatData.clipIndex = clipNames.indexOf(clipName);
    if (vatData.clipIndex < 0) vatData.clipIndex = 0;
    
    setUniform('uClipIndex', vatData.clipIndex);
  } else {
    vatData.timeScale = THREE.MathUtils.lerp(vatData.timeScale, newTimeScale, delta * 5);
    vatData.loop = newLoop;
  }
  
  // Advance frame
  const clipData = animSet.clips.get(clipName);
  if (clipData) {
    const frameDelta = delta * VAT_BAKE_FPS * vatData.timeScale;
    vatData.frameIndex += frameDelta;
    
    if (vatData.loop) {
      vatData.frameIndex = vatData.frameIndex % clipData.frameCount;
    } else {
      vatData.frameIndex = Math.min(vatData.frameIndex, clipData.frameCount - 1);
    }
    
    vatData.frameBlend = vatData.frameIndex - Math.floor(vatData.frameIndex);
    
    setUniform('uFrameIndex', vatData.frameIndex);
    setUniform('uFrameBlend', vatData.frameBlend);
    setUniform('uTime', performance.now() * 0.001);
  }
  
  // Damage flash
  if (zombie.gltfRig && zombie.gltfRig.currentState === 'STAGGER') {
    setUniform('uFlash', Math.min(1.0, (material.uniforms.uFlash?.value ?? 0) + delta * 10));
  } else {
    setUniform('uFlash', Math.max(0, (material.uniforms.uFlash?.value ?? 0) - delta * 5));
  }
  
  // Boss weakpoint pulse
  if (zombie.weakpointMesh) {
    const pulse = 1.0 + Math.sin(performance.now() * 0.006) * 0.22;
    zombie.weakpointMesh.scale.setScalar(pulse);
  }
  
  // Decapitation
  if (zombie.isDecapitated) {
    setUniform('uDecapitated', 1);
  }
}

/**
 * Dispose VAT resources
 */
export function disposeVat(): void {
  for (const [, animSet] of vatCache) {
    animSet.baseGeometry.dispose();
    animSet.bindPoseTexture.dispose();
    for (const [, data] of animSet.clips) {
      data.texture.dispose();
    }
    if (animSet.boneTexture) animSet.boneTexture.dispose();
  }
  vatCache.clear();
}