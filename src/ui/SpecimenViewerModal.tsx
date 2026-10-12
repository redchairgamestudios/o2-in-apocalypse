import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { X, RotateCcw, ZoomIn, ZoomOut, Skull, ShieldAlert, Sparkles, Activity } from 'lucide-react';
import { ZombieModelFactory, ZombieInstance } from '../models/ZombieModel';
import { ZOMBIE_DEFINITIONS } from '../data/zombies';
import { MeltyZombieTexture } from '../textures/MeltyZombieTexture';

interface SpecimenViewerModalProps {
  onClose: () => void;
  onDeployCombat?: () => void;
}

export const SpecimenViewerModal: React.FC<SpecimenViewerModalProps> = ({ onClose, onDeployCombat }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<'ANATOMY' | 'TEXTURE' | 'DATA'>('ANATOMY');
  const [isWireframe, setIsWireframe] = useState<boolean>(false);
  const [animState, setAnimState] = useState<'IDLE' | 'WALK' | 'ATTACK'>('WALK');

  const zombieRef = useRef<ZombieInstance | null>(null);
  const animTimeRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const previousMouseXRef = useRef<number>(0);
  const previousMouseYRef = useRef<number>(0);
  const rotationYRef = useRef<number>(0);
  const rotationXRef = useRef<number>(0);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const zoomDistRef = useRef<number>(2.4);

  useEffect(() => {
    if (!mountRef.current) return;
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0c);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50);
    camera.position.set(0, 1.1, zoomDistRef.current);
    cameraRef.current = camera;

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mountRef.current.appendChild(renderer.domElement);

    // 3. Studio Pedestal Lighting
    const ambientLight = new THREE.AmbientLight(0x403030, 0.9);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffedd5, 2.2);
    keyLight.position.set(2.5, 3.5, 3);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7dd3fc, 1.2);
    fillLight.position.set(-2.5, 2, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xef4444, 2.8);
    rimLight.position.set(0, 3, -3);
    scene.add(rimLight);

    // Under-chin bio-glow light
    const underGlow = new THREE.PointLight(0xf59e0b, 1.4, 4);
    underGlow.position.set(0, 0.4, 1.0);
    scene.add(underGlow);

    // 4. Pedestal Grid
    const gridHelper = new THREE.GridHelper(3, 16, 0xdc2626, 0x27272a);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    const pedestalGeo = new THREE.CylinderGeometry(1.2, 1.3, 0.1, 32);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x141417,
      roughness: 0.6,
      metalness: 0.4,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -0.05;
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    // Pedestal warning ring
    const ringGeo = new THREE.RingGeometry(1.05, 1.15, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xdc2626, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.002;
    scene.add(ring);

    // 5. Create Melty Zombie Model
    const meltyInstance = ZombieModelFactory.createZombie(
      'walker',
      'specimen_01',
      ZOMBIE_DEFINITIONS.walker
    );
    zombieRef.current = meltyInstance;
    scene.add(meltyInstance.mesh);

    // Center model
    meltyInstance.mesh.position.set(0, 0, 0);

    // 6. Mouse Drag Interaction
    const dom = renderer.domElement;

    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      previousMouseXRef.current = e.clientX;
      previousMouseYRef.current = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - previousMouseXRef.current;
      const deltaY = e.clientY - previousMouseYRef.current;
      previousMouseXRef.current = e.clientX;
      previousMouseYRef.current = e.clientY;

      rotationYRef.current += deltaX * 0.01;
      rotationXRef.current = Math.max(-0.5, Math.min(0.8, rotationXRef.current + deltaY * 0.008));
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomDistRef.current = Math.max(1.2, Math.min(3.8, zoomDistRef.current + e.deltaY * 0.0025));
      if (cameraRef.current) {
        cameraRef.current.position.z = zoomDistRef.current;
      }
    };

    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    // Touch support for mobile
    let touchStartX = 0;
    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        rotationYRef.current += dx * 0.015;
        rotationXRef.current = Math.max(-0.5, Math.min(0.8, rotationXRef.current + dy * 0.01));
      }
    };
    dom.addEventListener('touchstart', onTouchStart);
    dom.addEventListener('touchmove', onTouchMove);

    // 7. Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      animTimeRef.current += delta;

      // Smooth auto rotation when not dragging
      if (!isDraggingRef.current) {
        rotationYRef.current += delta * 0.35;
      }

      if (meltyInstance) {
        meltyInstance.mesh.rotation.y = rotationYRef.current;
        meltyInstance.mesh.rotation.x = rotationXRef.current;

        // Custom animation based on state
        if (animState === 'WALK') {
          meltyInstance.state = 'CHASE';
          ZombieModelFactory.updateZombieAnimation(meltyInstance, delta, 3.0);
        } else if (animState === 'ATTACK') {
          meltyInstance.state = 'ATTACK';
          ZombieModelFactory.updateZombieAnimation(meltyInstance, delta, 1.0);
        } else {
          meltyInstance.state = 'IDLE';
          ZombieModelFactory.updateZombieAnimation(meltyInstance, delta, 10.0);
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    // 8. Resize Handler
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('touchstart', onTouchStart);
      dom.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (mountRef.current && dom.parentNode === mountRef.current) {
        mountRef.current.removeChild(dom);
      }
    };
  }, [animState]);

  // Wireframe toggle effect
  useEffect(() => {
    if (!zombieRef.current) return;
    zombieRef.current.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => (m.wireframe = isWireframe));
        } else {
          obj.material.wireframe = isWireframe;
        }
      }
    });
  }, [isWireframe]);

  return (
    <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-3 sm:p-6 pointer-events-auto overflow-hidden">
      {/* Top Header */}
      <div className="flex justify-between items-center pb-3 border-b border-zinc-800 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-red-950/80 border border-red-500/60 rounded shrink-0">
            <Skull className="w-5 h-5 text-red-500 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-teko text-xl sm:text-2xl md:text-3xl font-bold tracking-wide text-white leading-none">
                BIO-SPECIMEN ANALYSIS: MELTY ZOMBIE
              </h2>
              <span className="font-mono text-[10px] bg-red-900/60 text-red-300 border border-red-500/40 px-1.5 py-0.5 rounded uppercase shrink-0">
                CLASS-4 MUTANT
              </span>
            </div>
            <p className="font-military text-[11px] text-zinc-400 truncate short:hidden">
              Texture Pattern ID: Material__meltyzombie_diffuse_tga_baseColor.png
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 active:scale-95 transition-all shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Container — side-by-side from 640px so landscape phones/tablets
          never squeeze the intel panel out of view */}
      <div className="flex-1 grid grid-cols-1 min-[640px]:grid-cols-12 gap-3 sm:gap-4 mt-3 overflow-hidden min-h-0">
        {/* Left Column: 3D Interactive Holo-Stage */}
        <div className="min-[640px]:col-span-8 relative bg-zinc-950/90 border border-zinc-800 rounded-lg overflow-hidden flex flex-col min-h-[220px] min-[640px]:min-h-0">
          {/* 3D Viewport Mount */}
          <div ref={mountRef} className="w-full flex-1 cursor-grab active:cursor-grabbing" />

          {/* Floating Holo-Controls Bar */}
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 p-2 bg-black/80 backdrop-blur-md border border-zinc-800 rounded">
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="font-mono text-[10px] text-zinc-400 uppercase hidden sm:inline">ANIMATION:</span>
              {(['WALK', 'ATTACK', 'IDLE'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setAnimState(mode)}
                  className={`px-2.5 py-1 rounded font-teko text-sm font-bold border transition-all ${
                    animState === mode
                      ? 'bg-red-600 text-white border-red-500 shadow-md'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsWireframe(!isWireframe)}
                className={`px-2.5 py-1 rounded font-teko text-sm font-bold border transition-all ${
                  isWireframe
                    ? 'bg-amber-600 text-white border-amber-500'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white'
                }`}
              >
                {isWireframe ? 'TEXTURE VIEW' : 'WIREFRAME MESH'}
              </button>

              <button
                onClick={() => {
                  rotationYRef.current = 0;
                  rotationXRef.current = 0;
                  zoomDistRef.current = 2.4;
                  if (cameraRef.current) cameraRef.current.position.z = 2.4;
                }}
                className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded text-zinc-300 hover:text-white"
                title="Reset View"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Hint Overlay */}
          <div className="absolute top-3 left-3 pointer-events-none font-mono text-[10px] text-zinc-500 bg-black/60 px-2 py-1 rounded border border-zinc-800">
            DRAG TO ROTATE 360° | SCROLL TO ZOOM
          </div>
        </div>

        {/* Right Column: Specimen Intel & Texture Mapping Breakdown */}
        <div className="min-[640px]:col-span-4 flex flex-col bg-zinc-950/90 border border-zinc-800 rounded-lg p-4 overflow-y-auto space-y-4">
          {/* Navigation Tabs */}
          <div className="flex border-b border-zinc-800 pb-2 gap-2">
            {(['ANATOMY', 'TEXTURE', 'DATA'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1 font-teko text-lg font-bold rounded transition-all ${
                  activeTab === tab
                    ? 'bg-zinc-800 text-white border-b-2 border-red-500'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'ANATOMY' && (
            <div className="space-y-3 font-military text-xs">
              <div className="p-2.5 bg-zinc-900/80 border border-zinc-800 rounded">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold font-teko text-base mb-1">
                  <Activity className="w-4 h-4" /> 1. STRIATED THORACIC RIBCAGE
                </div>
                <p className="text-zinc-300 leading-relaxed">
                  Emaciated, broad upper torso displaying horizontal muscle striations across the ribcage, pectoral fibers, and exposed clavicles, precisely matching the pattern texture.
                </p>
              </div>

              <div className="p-2.5 bg-zinc-900/80 border border-zinc-800 rounded">
                <div className="flex items-center gap-1.5 text-red-400 font-bold font-teko text-base mb-1">
                  <ShieldAlert className="w-4 h-4" /> 2. ABDOMINAL PUSTULE CLUSTER
                </div>
                <p className="text-zinc-300 leading-relaxed">
                  Sunken midsection and pelvic girdle covered in a dense colony of necrotic crimson circular pustules and blister lesions, directly derived from the texture atlas.
                </p>
              </div>

              <div className="p-2.5 bg-zinc-900/80 border border-zinc-800 rounded">
                <div className="flex items-center gap-1.5 text-yellow-400 font-bold font-teko text-base mb-1">
                  <Sparkles className="w-4 h-4" /> 3. GAUNT CRANIUM & AMBER EYES
                </div>
                <p className="text-zinc-300 leading-relaxed">
                  Deep dark sunken orbital eye cavities housing glowing amber-yellow infected irises with pupils, sunken triangular nasal cavity, and open snarling jaw with decayed enamel teeth arches.
                </p>
              </div>

              <div className="p-2.5 bg-zinc-900/80 border border-zinc-800 rounded">
                <div className="flex items-center gap-1.5 text-red-500 font-bold font-teko text-base mb-1">
                  <Skull className="w-4 h-4" /> 4. CLAW TALONS & BARE FEET
                </div>
                <p className="text-zinc-300 leading-relaxed">
                  Skeletal hands with 5 splayed claw fingers ending in dark curved talons. Bare emaciated zombie feet with elongated decaying toes resting on the floor (no combat boots).
                </p>
              </div>
            </div>
          )}

          {activeTab === 'TEXTURE' && (
            <div className="space-y-3 font-military text-xs">
              <p className="text-zinc-400">
                Texture coordinates mapped directly from <span className="text-white font-mono">Material__meltyzombie_diffuse_tga_baseColor.png</span>:
              </p>

              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-zinc-900 border border-zinc-800 rounded">
                  <span className="font-bold text-white">Thoracic Ribs / Chest</span>
                  <span className="font-mono text-amber-400 text-[11px]">U: 0.02-0.54, V: 0.44-0.96</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-zinc-900 border border-zinc-800 rounded">
                  <span className="font-bold text-white">Abdominal Pustules</span>
                  <span className="font-mono text-red-400 text-[11px]">U: 0.54-0.98, V: 0.54-0.98</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-zinc-900 border border-zinc-800 rounded">
                  <span className="font-bold text-white">Gaunt Face & Teeth</span>
                  <span className="font-mono text-yellow-400 text-[11px]">U: 0.02-0.42, V: 0.04-0.42</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-zinc-900 border border-zinc-800 rounded">
                  <span className="font-bold text-white">Limbs & Arms</span>
                  <span className="font-mono text-blue-400 text-[11px]">U: 0.42-0.78, V: 0.18-0.54</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-zinc-900 border border-zinc-800 rounded">
                  <span className="font-bold text-white">Hand Talons & Claws</span>
                  <span className="font-mono text-green-400 text-[11px]">U: 0.65-0.98, V: 0.02-0.34</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-zinc-900 border border-zinc-800 rounded">
                  <span className="font-bold text-white">Diseased Eyeball</span>
                  <span className="font-mono text-amber-500 text-[11px]">U: 0.38-0.62, V: 0.02-0.22</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'DATA' && (
            <div className="space-y-3 font-military text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-zinc-900 border border-zinc-800 rounded">
                  <div className="text-[10px] text-zinc-500 uppercase">HIT POINTS</div>
                  <div className="font-teko text-2xl font-bold text-red-500">65 HP</div>
                </div>
                <div className="p-2 bg-zinc-900 border border-zinc-800 rounded">
                  <div className="text-[10px] text-zinc-500 uppercase">RUN SPEED</div>
                  <div className="font-teko text-2xl font-bold text-amber-400">2.0 M/S</div>
                </div>
                <div className="p-2 bg-zinc-900 border border-zinc-800 rounded">
                  <div className="text-[10px] text-zinc-500 uppercase">CLAW DAMAGE</div>
                  <div className="font-teko text-2xl font-bold text-red-400">16 DMG</div>
                </div>
                <div className="p-2 bg-zinc-900 border border-zinc-800 rounded">
                  <div className="text-[10px] text-zinc-500 uppercase">KILL REWARD</div>
                  <div className="font-teko text-2xl font-bold text-green-400">20 CREDITS</div>
                </div>
              </div>

              <div className="p-3 bg-red-950/40 border border-red-500/40 rounded space-y-1">
                <div className="font-teko text-lg font-bold text-red-400">TACTICAL ADVISORY</div>
                <p className="text-zinc-300">
                  Target head for 2.5x critical decapitation multiplier. Watch for narrow alley flanks where these specimens ambush in packs.
                </p>
              </div>
            </div>
          )}

          {/* Action Button */}
          {onDeployCombat && (
            <button
              onClick={onDeployCombat}
              className="mt-auto w-full py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-teko text-xl font-bold rounded shadow-lg transition-all"
            >
              DEPLOY MISSION TO ENGAGE
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
