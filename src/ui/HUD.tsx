import React, { useEffect, useRef, useState } from 'react';
import { PlayerController } from '../player/PlayerController';
import { MissionManager } from '../missions/MissionManager';
import { ZombieManager } from '../zombies/ZombieManager';
import { WeatherSystem } from '../effects/WeatherSystem';
import { ParticleSystem } from '../effects/ParticleSystem';
import {
  Shield,
  Crosshair,
  DollarSign,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  Skull,
  Zap,
  Flashlight,
  ArrowUp,
  ArrowDown,
  Wind,
  Menu,
  Bomb,
  ChevronDown,
  ChevronUp,
  Radio,
  Compass,
  Users,
  Plane,
  Hand,
} from 'lucide-react';
import { WeaponTypeKey, AllyOrder } from '../types';
import { AirStrikeManager } from '../tactical/AirStrikeManager';

interface HUDProps {
  player: PlayerController;
  missionManager: MissionManager;
  zombieManager: ZombieManager;
  isMobile: boolean;
  isPointerLocked?: boolean;
  isFlashlightOn?: boolean;
  onToggleFlashlight?: () => void;
  onPause: () => void;
  onSwitchWeapon: () => void;
  onSelectWeapon?: (weaponKey: WeaponTypeKey) => void;
  unlockedWeapons?: WeaponTypeKey[];
  onReload: () => void;
  onJump?: () => void;
  onInteract: () => void;
  onSprintToggle: () => void;
  isSprinting: boolean;
  hitFeedback: { hit: boolean; isHeadshot: boolean; timestamp: number };
  grenadesCount: number;
  turretsCount: number;
  onThrowGrenade: () => void;
  onDeployTurret: () => void;
  onShove?: () => void;
  hasAllyRecruit?: boolean;
  allyStatus?: {
    isAlive: boolean;
    hp: number;
    maxHp: number;
    kills: number;
    radioMessage: string;
    squadCount?: number;
    aliveCount?: number;
    members?: Array<{
      id: string;
      name: string;
      role: string;
      hp: number;
      maxHp: number;
      isAlive: boolean;
      kills: number;
    }>;
  };
  hasDrone?: boolean;
  droneStatus?: {
    isDeployed: boolean;
    batteryRemaining: number;
    maxBattery: number;
    cooldownRemaining: number;
    maxCooldown: number;
    isReady: boolean;
    altitude?: number;
    targetAltitude?: number;
  };
  onDeployDrone?: () => void;
  onDroneAscend?: () => void;
  onDroneDescend?: () => void;
  allyOrder?: AllyOrder;
  onToggleAllyOrder?: () => void;
  killFeed?: Array<{
    id: string;
    killer: string;
    weapon: string;
    victim: string;
    isHeadshot: boolean;
    isBoss: boolean;
    timestamp: number;
  }>;
  showFps?: boolean;
  showPerformancePanel?: boolean;
  rendererInfo?: {
    drawCalls: number;
    triangles: number;
    lines: number;
    points: number;
    geometries: number;
    textures: number;
  };
  particleCount?: number;
  frameTime?: number;
  deviceTier?: string;
  resolutionScale?: number;
}

export const HUD: React.FC<HUDProps> = ({
  player,
  missionManager,
  zombieManager,
  isMobile,
  isPointerLocked = false,
  isFlashlightOn = true,
  onToggleFlashlight,
  onPause,
  onSwitchWeapon,
  onSelectWeapon,
  unlockedWeapons = [],
  onReload,
  onJump,
  onInteract,
  onSprintToggle,
  isSprinting,
  hitFeedback,
  grenadesCount,
  turretsCount,
  onThrowGrenade,
  onDeployTurret,
  onShove,
  hasAllyRecruit = false,
  allyStatus,
  hasDrone = false,
  droneStatus,
  onDeployDrone,
  onDroneAscend,
  onDroneDescend,
  allyOrder = 'FOLLOW_ME',
  onToggleAllyOrder,
  killFeed = [],
  showFps = false,
  showPerformancePanel = false,
  deviceTier,
  resolutionScale,
}) => {
  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [, setFrameTick] = useState<number>(0);
  const [fps, setFps] = useState<number>(60);
  const frameTimesRef = useRef<number[]>([]);
  
  // Performance panel state - rolling percentiles and averages
  const [perfStats, setPerfStats] = useState<{
    avgFps: number;
    p1Fps: number;
    p5Fps: number;
    p99Fps: number;
    avgFrameTime: number;
    p99FrameTime: number;
    sampleCount: number;
  }>({
    avgFps: 60,
    p1Fps: 0,
    p5Fps: 0,
    p99Fps: 0,
    avgFrameTime: 0,
    p99FrameTime: 0,
    sampleCount: 0,
  });
  const fpsHistoryRef = useRef<number[]>([]);
  const frameTimeHistoryRef = useRef<number[]>([]);

  // Auto-hide objective after 5 seconds
  const [isObjectiveExpanded, setIsObjectiveExpanded] = useState<boolean>(!isMobile);
  const objectiveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard shortcut listener: Press 'O' or 'Tab' on PC to toggle/unhide objective anytime
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyO' || e.key === 'o' || e.key === 'O' || e.code === 'Tab') {
        if (e.code === 'Tab') {
          e.preventDefault();
        }
        setIsObjectiveExpanded((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // High performance HUD update ticker
  useEffect(() => {
    let animId: number;
    let lastTick = 0;
    const loop = (now: number) => {
      animId = requestAnimationFrame(loop);
      
      // Track FPS
      frameTimesRef.current.push(now);
      if (frameTimesRef.current.length > 60) frameTimesRef.current.shift();
      if (frameTimesRef.current.length >= 2) {
        const duration = frameTimesRef.current[frameTimesRef.current.length - 1] - frameTimesRef.current[0];
        const currentFps = Math.round((frameTimesRef.current.length - 1) * 1000 / duration);
        setFps(currentFps);
        
        // Track rolling FPS and frame time history for percentile calculation
        fpsHistoryRef.current.push(currentFps);
        if (fpsHistoryRef.current.length > 300) fpsHistoryRef.current.shift(); // 5 minutes at 1Hz
        
        const frameTime = duration / (frameTimesRef.current.length - 1);
        frameTimeHistoryRef.current.push(frameTime);
        if (frameTimeHistoryRef.current.length > 300) frameTimeHistoryRef.current.shift();
        
        // Calculate percentiles every second
        if (fpsHistoryRef.current.length >= 10) {
          const sortedFps = [...fpsHistoryRef.current].sort((a, b) => a - b);
          const sortedFrameTimes = [...frameTimeHistoryRef.current].sort((a, b) => a - b);
          const count = sortedFps.length;
          
          const avgFps = Math.round(sortedFps.reduce((a, b) => a + b, 0) / count);
          const p1Idx = Math.max(0, Math.floor(count * 0.01));
          const p5Idx = Math.max(0, Math.floor(count * 0.05));
          const p99Idx = Math.min(count - 1, Math.floor(count * 0.99));
          
          const avgFrameTime = sortedFrameTimes.reduce((a, b) => a + b, 0) / count;
          const p99FrameTime = sortedFrameTimes[p99Idx];
          
          setPerfStats({
            avgFps,
            p1Fps: sortedFps[p1Idx],
            p5Fps: sortedFps[p5Idx],
            p99Fps: sortedFps[p99Idx],
            avgFrameTime: Math.round(avgFrameTime * 100) / 100,
            p99FrameTime: Math.round(p99FrameTime * 100) / 100,
            sampleCount: count,
          });
        }
      }
      
      if (now - lastTick > 50) {
        lastTick = now;
        setFrameTick(now);
      }
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const curObj = missionManager.getCurrentObjective();
  // Distance to the beacon anchor (nearest survivor/sample for rescue missions,
  // the objective point otherwise) — always a meaningful target, never blank space
  const anchor = missionManager.getObjectiveAnchor(player.position);
  const dist = anchor ? Math.round(player.position.distanceTo(anchor)) : missionManager.getDistanceToCurrentObjective(player.position);
  const boss = zombieManager.bossInstance;
  const weather = WeatherSystem.getCurrentWeather();

  // Reset auto-hide whenever a new objective is triggered (Mobile only auto-hides after 4s)
  useEffect(() => {
    if (!curObj) return;

    // Desktop stays expanded by default; mobile stays collapsed to prevent screen clutter
    if (!isMobile) {
      setIsObjectiveExpanded(true);
    }

    if (objectiveTimerRef.current) {
      clearTimeout(objectiveTimerRef.current);
    }

    if (isMobile && isObjectiveExpanded) {
      objectiveTimerRef.current = setTimeout(() => {
        setIsObjectiveExpanded(false);
      }, 4000);
    }

    return () => {
      if (objectiveTimerRef.current) {
        clearTimeout(objectiveTimerRef.current);
      }
    };
  }, [curObj?.title, missionManager.currentMission?.id, isMobile, isObjectiveExpanded]);

  // Render Radar Canvas
  useEffect(() => {
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Red alert: a heavy wave (10+ hostiles) closing within 42m
    let nearbyHorde = 0;
    for (const z of zombieManager.zombies) {
      if (!z.isDead && z.mesh.position.distanceTo(player.position) < 42) nearbyHorde++;
    }
    const waveAlert = nearbyHorde > 10;

    ctx.setTransform(2, 0, 0, 2, 0, 0); // render at 2x for a crisp enlarged dial
    ctx.clearRect(0, 0, 96, 96);

    // Radar background (turns blood-red under a heavy approaching wave)
    ctx.fillStyle = waveAlert ? 'rgba(58,8,8,0.82)' : 'rgba(10, 15, 12, 0.75)';
    ctx.beginPath();
    ctx.arc(48, 48, 46, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = waveAlert ? 'rgba(239, 68, 68, 0.75)' : 'rgba(34, 197, 94, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Range rings
    [16, 32].forEach((r) => {
      ctx.beginPath();
      ctx.arc(48, 48, r, 0, Math.PI * 2);
      ctx.strokeStyle = waveAlert ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.18)';
      ctx.stroke();
    });

    // Player direction tick
    ctx.fillStyle = waveAlert ? '#f87171' : '#22c55e';
    ctx.beginPath();
    ctx.moveTo(48, 43);
    ctx.lineTo(44, 53);
    ctx.lineTo(52, 53);
    ctx.closePath();
    ctx.fill();

    const maxRadarDist = 38;
    const scale = 44 / maxRadarDist;

    // Draw Objective Blip (anchor = beacon target, works for rescue/sample objectives too)
    const anchor = missionManager.getObjectiveAnchor(player.position);
    if (curObj && anchor) {
      const dx = anchor.x - player.position.x;
      const dz = anchor.z - player.position.z;
      const blipDist = Math.hypot(dx, dz);

      if (blipDist <= maxRadarDist * 1.5) {
        const blipAngle = Math.atan2(dx, dz) - player.yaw;
        const clampedDist = Math.min(blipDist, maxRadarDist);
        const bx = 48 + Math.sin(blipAngle) * clampedDist * scale;
        const by = 48 - Math.cos(blipAngle) * clampedDist * scale;

        ctx.fillStyle = curObj.type === 'collect_samples' ? '#f59e0b' : curObj.type === 'rescue_survivors' ? '#22d3ee' : '#eab308';
        ctx.beginPath();
        ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw Zombie Blips
    for (const z of zombieManager.zombies) {
      if (z.isDead) continue;
      const dx = z.mesh.position.x - player.position.x;
      const dz = z.mesh.position.z - player.position.z;
      const blipDist = Math.hypot(dx, dz);

      if (blipDist < maxRadarDist) {
        const blipAngle = Math.atan2(dx, dz) - player.yaw;
        const bx = 48 + Math.sin(blipAngle) * blipDist * scale;
        const by = 48 - Math.cos(blipAngle) * blipDist * scale;

        ctx.fillStyle = z.type === 'colossus' ? '#ef4444' : z.type === 'spitter' ? '#84cc16' : '#f97316';
        ctx.beginPath();
        ctx.arc(bx, by, z.type === 'colossus' ? 4.5 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [player.position, player.yaw, curObj, zombieManager.zombies]);

  const showHit = Date.now() - hitFeedback.timestamp < 140;

  // Heavy-wave alert: 10+ hostiles closing within 42m turns the radar red
  const nearbyHorde = zombieManager.zombies.reduce(
    (n, z) => (!z.isDead && z.mesh.position.distanceTo(player.position) < 42 ? n + 1 : n),
    0
  );
  const waveAlert = nearbyHorde > 10;
  const isHeadshot = hitFeedback.isHeadshot;

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden z-20 flex flex-col justify-between">
      {/* Low Health Vignette Warning */}
      {player.hp < 35 && (
        <div
          className="absolute inset-0 pointer-events-none bg-red-950/40 mix-blend-multiply transition-opacity duration-300 animate-pulse"
          style={{
            boxShadow: 'inset 0 0 100px rgba(185, 28, 28, 0.85)',
          }}
        />
      )}

      {/* DYNAMIC VISCERAL SCREEN BLOOD & SLIDING DRIP SPLATTERS */}
      {ParticleSystem.screenBloodIntensity > 0.05 && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-200 z-10"
          style={{
            background: `radial-gradient(circle, rgba(136, 19, 55, 0.02) 40%, rgba(127, 29, 29, ${Math.min(0.48, ParticleSystem.screenBloodIntensity * 0.55)}) 100%)`,
          }}
        />
      )}

      {ParticleSystem.screenSplats && ParticleSystem.screenSplats.length > 0 && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {ParticleSystem.screenSplats.map((splat) => {
            const isAcid = splat.type === 'acid';
            const mainColor = isAcid ? '#65a30d' : '#991b1b';
            const darkColor = isAcid ? '#365314' : '#450a0a';
            return (
              <div
                key={splat.id}
                className="absolute pointer-events-none"
                style={{
                  left: `${splat.x}%`,
                  top: `${splat.y}%`,
                  opacity: Math.max(0, Math.min(1, splat.alpha)),
                  transform: `translate(-50%, -50%) rotate(${splat.rotation}deg)`,
                }}
              >
                <svg
                  width={splat.size}
                  height={splat.size + splat.dripLength}
                  viewBox={`0 0 ${splat.size} ${splat.size + splat.dripLength}`}
                  className="overflow-visible filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]"
                >
                  {/* Central impact droplet */}
                  <ellipse
                    cx={splat.size / 2}
                    cy={splat.size / 2}
                    rx={splat.size * 0.38}
                    ry={splat.size * 0.32}
                    fill={mainColor}
                  />
                  <ellipse
                    cx={splat.size / 2 - 1.5}
                    cy={splat.size / 2 - 1.5}
                    rx={splat.size * 0.22}
                    ry={splat.size * 0.18}
                    fill={darkColor}
                  />
                  {/* Surrounding splatter micro-droplets */}
                  <circle cx={splat.size * 0.18} cy={splat.size * 0.22} r={splat.size * 0.08} fill={mainColor} />
                  <circle cx={splat.size * 0.82} cy={splat.size * 0.28} r={splat.size * 0.07} fill={mainColor} />
                  <circle cx={splat.size * 0.25} cy={splat.size * 0.78} r={splat.size * 0.09} fill={mainColor} />
                  <circle cx={splat.size * 0.8} cy={splat.size * 0.75} r={splat.size * 0.06} fill={mainColor} />
                  {/* Visceral downward running drip streak */}
                  {splat.dripLength > 6 && (
                    <path
                      d={`M ${splat.size / 2 - 3.5} ${splat.size * 0.55} Q ${splat.size / 2 - 1.5} ${splat.size * 0.6 + splat.dripLength * 0.5} ${splat.size / 2} ${splat.size * 0.55 + splat.dripLength} Q ${splat.size / 2 + 1.5} ${splat.size * 0.6 + splat.dripLength * 0.5} ${splat.size / 2 + 3.5} ${splat.size * 0.55} Z`}
                      fill={darkColor}
                    />
                  )}
                  {splat.dripLength > 14 && (
                    <circle
                      cx={splat.size / 2}
                      cy={splat.size * 0.55 + splat.dripLength + 2.5}
                      r={3}
                      fill={mainColor}
                    />
                  )}
                </svg>
              </div>
            );
          })}
        </div>
      )}

      {/* Desktop Aim Guidance */}
      {!isMobile && !isPointerLocked && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/85 border border-amber-500/60 px-3 py-1 rounded-full text-amber-300 font-military text-[11px] uppercase tracking-wider flex items-center gap-2 shadow-lg backdrop-blur-xs z-30 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
          <span>Click screen to aim • [Q] Switch Weapon • [Shift] Sprint • [F] Flashlight</span>
        </div>
      )}

      {/* TOP HEADER CONTAINER (safe-area aware for notched landscape phones) */}
      <div className="flex justify-between items-start hud-safe-pad">
        {/* FPS Counter (top-left when enabled; hidden while the full perf panel is up — it shows FPS already) */}
        {showFps && !showPerformancePanel && (
          <div className="absolute left-4 top-4 z-30 bg-black/85 border border-zinc-700 px-3 py-1.5 rounded shadow-lg backdrop-blur-xs font-mono text-xs">
            <div className="flex items-center gap-2 text-cyan-400">
              <span className="font-teko text-[10px] uppercase tracking-wider">FPS</span>
              <span className={`font-bold text-lg ${fps < 30 ? 'text-red-400' : fps < 45 ? 'text-amber-400' : 'text-green-400'}`}>
                {fps}
              </span>
            </div>
          </div>
        )}

        {/* PERFORMANCE PANEL (top-left, below FPS when enabled) */}
        {showPerformancePanel && rendererInfo && (
          <div className="absolute left-4 top-4 z-30 bg-black/90 border border-cyan-500/60 px-3 py-2 rounded shadow-lg backdrop-blur-xs font-mono text-[10px] text-cyan-300 min-w-[200px] max-w-[240px]">
            <div className="flex items-center justify-between mb-1 border-b border-cyan-900/50 pb-1">
              <span className="font-teko text-cyan-400 uppercase tracking-wider text-xs">PERF MONITOR</span>
              <span className={`font-bold ${fps < 30 ? 'text-red-400' : fps < 45 ? 'text-amber-400' : 'text-green-400'}`}>
                {fps} FPS
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[9px]">
              {/* FPS Stats */}
              <div className="flex justify-between">
                <span className="text-zinc-400">Avg FPS</span>
                <span className={`font-bold ${perfStats.avgFps < 30 ? 'text-red-400' : perfStats.avgFps < 45 ? 'text-amber-400' : 'text-green-400'}`}>
                  {perfStats.avgFps}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">1% Low</span>
                <span className={`font-bold ${perfStats.p1Fps < 20 ? 'text-red-400' : perfStats.p1Fps < 30 ? 'text-amber-400' : 'text-green-400'}`}>
                  {perfStats.p1Fps}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">5% Low</span>
                <span className={`font-bold ${perfStats.p5Fps < 25 ? 'text-red-400' : perfStats.p5Fps < 35 ? 'text-amber-400' : 'text-green-400'}`}>
                  {perfStats.p5Fps}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Frame Time (avg)</span>
                <span className="font-bold text-white">{perfStats.avgFrameTime} ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Frame Time (P99)</span>
                <span className="font-bold text-white">{perfStats.p99FrameTime} ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Samples</span>
                <span className="font-bold text-white">{perfStats.sampleCount}s</span>
              </div>
              
              {/* Renderer Stats */}
              <div className="flex justify-between">
                <span className="text-zinc-400">Draw Calls</span>
                <span className="font-bold text-white">{rendererInfo.drawCalls}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Triangles</span>
                <span className="font-bold text-white">{rendererInfo.triangles.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Lines</span>
                <span className="font-bold text-white">{rendererInfo.lines.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Points</span>
                <span className="font-bold text-white">{rendererInfo.points.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Geometries</span>
                <span className="font-bold text-white">{rendererInfo.geometries}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Textures</span>
                <span className="font-bold text-white">{rendererInfo.textures}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Active Zombies</span>
                <span className="font-bold text-white">
                  {zombieManager.zombies.filter(z => !z.isDead).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Particles</span>
                <span className="font-bold text-white">{particleCount ?? 0}</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-cyan-900/50 text-[8px] text-zinc-500">
              <div>Viewport: {window.innerWidth}×{window.innerHeight}</div>
              <div>DPR: {window.devicePixelRatio.toFixed(2)}{resolutionScale !== undefined && resolutionScale < 1 ? ` · dyn ${Math.round(resolutionScale * 100)}%` : ''}</div>
              {deviceTier && <div className="truncate">{deviceTier}</div>}
            </div>
          </div>
        )}

        {/* TOP LEFT: Compact Tactical Status Gauge (Health & Stamina Slimmed) */}
        <div className="flex items-start gap-1.5 sm:gap-2.5">
          {/* Compact Circular Radar */}
          <div className={`relative rounded-full border bg-black/70 p-0.5 flex items-center justify-center shrink-0 ${
            waveAlert
              ? 'border-red-500/90 shadow-red-950/70 animate-pulse'
              : 'border-green-500/40 shadow-green-950/40'
          } ${isMobile ? 'w-16 h-16' : 'w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28'}`}>
            <canvas ref={radarCanvasRef} width={192} height={192} className="w-full h-full" />
            <span className={`absolute bottom-0 font-mono text-[7px] sm:text-[9px] font-bold tracking-wider ${waveAlert ? 'text-red-400' : 'text-green-400'}`}>
              {waveAlert ? `${nearbyHorde}!` : dist !== null ? `${dist}m` : 'RADAR'}
            </span>
          </div>

          {/* Minimalist Dual Gauge: Vitality & Stamina */}
          <div className="flex flex-col gap-0.5 sm:gap-1">
            {/* Health Bar */}
            <div className={`bg-black/75 border border-zinc-800 px-1.5 sm:px-2 py-0.5 rounded shadow-sm flex flex-col ${
              isMobile ? 'w-24' : 'w-28 sm:w-36 md:w-40'
            }`}>
              <div className="flex items-center justify-between text-[9px] sm:text-xs">
                <span className="font-teko text-red-500 font-bold uppercase tracking-wider">VITALITY</span>
                <span className="font-military text-white font-bold">{Math.ceil(player.hp)} HP</span>
              </div>
              <div className="h-1 sm:h-2 w-full bg-zinc-900 rounded-xs overflow-hidden mt-0.5">
                <div
                  className={`h-full transition-all duration-150 ${
                    player.hp < 30 ? 'bg-red-600 animate-pulse' : 'bg-red-500 shadow-sm shadow-red-500/50'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100))}%` }}
                />
              </div>
            </div>

            {/* Stamina Bar */}
            <div className={`bg-black/75 border border-zinc-800 px-1.5 sm:px-2 py-0.5 rounded shadow-sm flex flex-col ${
              isMobile ? 'w-24' : 'w-28 sm:w-36 md:w-40'
            }`}>
              <div className="flex items-center justify-between text-[9px] sm:text-xs">
                <div className="flex items-center gap-0.5">
                  <Zap className={`w-2 h-2 sm:w-2.5 sm:h-2.5 ${player.isExhausted ? 'text-amber-400' : 'text-cyan-400'}`} />
                  <span className={`font-teko font-bold uppercase tracking-wider ${player.isExhausted ? 'text-amber-400' : 'text-cyan-400'}`}>
                    {player.isExhausted ? 'TIRED' : 'STAMINA'}
                  </span>
                </div>
                <span className={`font-military font-bold text-[9px] sm:text-xs ${player.isExhausted ? 'text-amber-400' : 'text-zinc-300'}`}>
                  {Math.round(player.stamina)}%
                </span>
              </div>
              <div className="h-0.5 sm:h-1.5 w-full bg-zinc-900 rounded-xs overflow-hidden mt-0.5">
                <div
                  className={`h-full transition-all duration-75 ${
                    player.isExhausted ? 'bg-amber-500 animate-pulse' : player.stamina < 25 ? 'bg-red-500' : 'bg-cyan-400'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, player.stamina))}%` }}
                />
              </div>
            </div>

            {/* Compact Currency */}
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-0.5 bg-black/70 border border-amber-500/30 px-1 py-0.2 rounded text-amber-400">
                <DollarSign className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400" />
                <span className="font-teko text-[11px] sm:text-sm font-bold tracking-wider">
                  {missionManager.stats.creditsEarned}
                </span>
              </div>
            </div>

            {/* DEDICATED ALLY HEALTH BAR & SQUAD STATUS */}
            {hasAllyRecruit && allyStatus && (
              <div className={`bg-black/85 border border-emerald-500/60 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded shadow-md flex flex-col mt-0.5 ${
                isMobile ? 'w-24' : 'w-28 sm:w-36 md:w-40'
              }`}>
                <div className="flex items-center justify-between text-[9px] sm:text-xs">
                  <div className="flex items-center gap-1">
                    <Users className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400 shrink-0" />
                    <span className="font-teko text-emerald-400 font-bold uppercase tracking-wider">
                      ALLY SQUAD
                    </span>
                  </div>
                  <span className={`font-military font-bold text-[8px] sm:text-[10px] ${
                    allyStatus.isAlive ? 'text-emerald-300' : 'text-red-500'
                  }`}>
                    {allyStatus.isAlive ? `${allyStatus.hp} HP` : 'KIA / DOWN'}
                  </span>
                </div>
                {/* Squad Health Bar */}
                <div className="h-1 sm:h-1.5 w-full bg-zinc-900 rounded-xs overflow-hidden mt-0.5 border border-zinc-800">
                  <div
                    className={`h-full transition-all duration-150 ${
                      !allyStatus.isAlive
                        ? 'bg-red-700'
                        : allyStatus.hp < allyStatus.maxHp * 0.3
                        ? 'bg-red-500 animate-pulse'
                        : allyStatus.hp < allyStatus.maxHp * 0.6
                        ? 'bg-amber-400'
                        : 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                    }`}
                    style={{
                      width: `${allyStatus.isAlive ? Math.max(0, Math.min(100, (allyStatus.hp / allyStatus.maxHp) * 100)) : 0}%`
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-0.5 text-[8px] text-zinc-400">
                  <span className="font-mono text-emerald-400 font-bold">
                    {allyStatus.aliveCount !== undefined ? `${allyStatus.aliveCount}/${allyStatus.squadCount || 1} ALIVE` : (allyStatus.isAlive ? 'ACTIVE' : 'MIA')}
                  </span>
                  <span className="font-mono text-amber-400">
                    {allyStatus.kills} KILLS
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TOP CENTER: Objective System (Auto-Hides on Mobile after 4s, Toggleable via [O] or [Tab] on PC) */}
        <div className="flex flex-col items-center max-w-[220px] sm:max-w-xs md:max-w-md pointer-events-auto select-none z-30">
          {curObj && !isObjectiveExpanded && (
            /* COLLAPSED MINIMAL OBJECTIVE PILL */
            <button
              onClick={() => setIsObjectiveExpanded(true)}
              className="bg-black/80 hover:bg-zinc-900 active:bg-black border border-red-500/60 text-white px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1.5 text-xs font-military active:scale-95 transition-all backdrop-blur-xs cursor-pointer pointer-events-auto"
              title={isMobile ? "Tap to view full objective" : "Press [O] or click to view full objective"}
            >
              <AlertCircle className="w-3 h-3 text-red-500 shrink-0 animate-pulse" />
              <span className="font-bold text-zinc-200 truncate max-w-[110px] sm:max-w-[200px] text-[10px] sm:text-[11px] uppercase">
                {curObj.title}
              </span>
              {dist !== null && (curObj.type === 'reach_zone' || curObj.type === 'interact_object' || curObj.type === 'collect_samples' || curObj.type === 'rescue_survivors') && (
                <span className="text-amber-400 font-mono text-[9px] sm:text-[10px] font-bold shrink-0">[{dist}m]</span>
              )}
              {curObj.type === 'kill_count' && curObj.targetCount && (
                <span className="text-yellow-400 font-mono text-[9px] sm:text-[10px] font-bold shrink-0">
                  [{curObj.currentCount || 0}/{curObj.targetCount}]
                </span>
              )}
              <ChevronDown className="w-3 h-3 text-red-400 shrink-0" />
            </button>
          )}

          {curObj && isObjectiveExpanded && (
            /* EXPANDED OBJECTIVE CARD */
            <div className="bg-black/90 border border-red-500/60 backdrop-blur-md px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-b-lg shadow-xl shadow-black w-full animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-auto">
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1.5 text-red-500 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest">
                  <AlertCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-500 animate-ping" />
                  <span>MISSION OBJECTIVE</span>
                </div>
                {/* Arrow & keybind badge to collapse objective */}
                <button
                  onClick={() => setIsObjectiveExpanded(false)}
                  className="text-zinc-400 hover:text-white px-1.5 py-0.5 rounded bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/80 flex items-center gap-1 text-[9px] sm:text-[10px] font-mono cursor-pointer transition-all"
                  title={isMobile ? "Tap to minimize objective" : "Press [O] or click to minimize objective"}
                >
                  <span>{!isMobile ? '[O] HIDE' : 'HIDE'}</span>
                  <ChevronUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </button>
              </div>

              <p className="font-military text-xs sm:text-sm font-bold text-white uppercase tracking-wide leading-tight">
                {curObj.title}
              </p>

              {curObj.type === 'kill_count' && curObj.targetCount && (
                <div className="text-[9px] sm:text-[11px] font-military text-yellow-400 font-bold mt-0.5">
                  [{curObj.currentCount || 0} / {curObj.targetCount} PURGED]
                </div>
              )}
              {curObj.type === 'rescue_survivors' && curObj.targetCount && (
                <div className="text-[9px] sm:text-[11px] font-military text-cyan-300 font-bold mt-0.5">
                  [{curObj.currentCount || 0} / {curObj.targetCount} RESCUED] — [E] NEAR CIVILIAN
                </div>
              )}
              {curObj.type === 'collect_samples' && curObj.targetCount && (
                <div className="text-[9px] sm:text-[11px] font-military text-amber-300 font-bold mt-0.5">
                  [{curObj.currentCount || 0} / {curObj.targetCount} SECURED] — WALK OVER CASES
                </div>
              )}
              {curObj.type === 'survive_time' && (
                <div className="text-[10px] sm:text-xs font-military text-red-400 font-bold animate-pulse mt-0.5">
                  SURVIVE: {Math.max(0, Math.ceil(missionManager.surviveTimer))}s
                </div>
              )}
              {dist !== null && (curObj.type === 'reach_zone' || curObj.type === 'interact_object') && (
                <div className="text-[9px] sm:text-[11px] font-military text-amber-400 font-bold mt-0.5">
                  TARGET DISTANCE: {dist}m
                </div>
              )}

              {/* Weather info - desktop only */}
              {!isMobile && (
                <div className="flex items-center justify-center gap-1 mt-1 pt-1 border-t border-zinc-800 text-[9px] sm:text-[10px] tracking-wider text-zinc-300">
                  <span>{weather.icon}</span>
                  <span className="font-bold text-white uppercase truncate">{weather.displayName}</span>
                  <span className="text-zinc-500">•</span>
                  <span className="flex items-center gap-0.5 text-zinc-400 shrink-0">
                    <Wind className="w-2.5 h-2.5 text-sky-400" />
                    <span>{weather.windSpeed} KM/H</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ALLY RADIO MESSAGE */}
          {hasAllyRecruit && allyStatus?.radioMessage && (
            <div className="mt-1 bg-emerald-950/80 border border-emerald-500/60 px-2 py-0.5 rounded shadow text-[9px] sm:text-[11px] text-emerald-200 font-military font-bold max-w-[200px] sm:max-w-xs text-center truncate">
              📻 {allyStatus.radioMessage}
            </div>
          )}
        </div>

        {/* TOP RIGHT: Desktop Tacticals, Ammo, Flashlight & Menu */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Tactical Frag Grenade (Desktop only) */}
          {!isMobile && (
            <button
              onClick={onThrowGrenade}
              disabled={grenadesCount <= 0}
              className={`pointer-events-auto border px-2 py-1 rounded flex items-center gap-1.5 transition-all active:scale-95 shadow-md cursor-pointer ${
                grenadesCount > 0
                  ? 'bg-red-950/80 border-red-500/80 text-red-300 hover:bg-red-900/80'
                  : 'bg-black/60 border-zinc-800 text-zinc-600 opacity-40 cursor-not-allowed'
              }`}
              title="Throw Frag Grenade [G]"
            >
              <Bomb className="w-3.5 h-3.5 text-red-400" />
              <div className="flex flex-col items-start leading-tight">
                <span className="font-teko text-xs tracking-wider font-bold">GRENADE [G]</span>
                <span className="font-mono text-[9px] font-semibold">{grenadesCount} LEFT</span>
              </div>
            </button>
          )}

          {/* Sentry Turret (Desktop only) */}
          {!isMobile && (
            <button
              onClick={onDeployTurret}
              disabled={turretsCount <= 0}
              className={`pointer-events-auto border px-2 py-1 rounded flex items-center gap-1.5 transition-all active:scale-95 shadow-md cursor-pointer ${
                turretsCount > 0
                  ? 'bg-blue-950/80 border-blue-500/80 text-blue-300 hover:bg-blue-900/80'
                  : 'bg-black/60 border-zinc-800 text-zinc-600 opacity-40 cursor-not-allowed'
              }`}
              title="Deploy Sentry Turret [T]"
            >
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <div className="flex flex-col items-start leading-tight">
                <span className="font-teko text-xs tracking-wider font-bold">TURRET [T]</span>
                <span className="font-mono text-[9px] font-semibold">{turretsCount} LEFT</span>
              </div>
            </button>
          )}

          {/* Combat Recon Drone (Desktop only) */}
          {!isMobile && hasDrone && onDeployDrone && (
            <button
              onClick={onDeployDrone}
              disabled={!droneStatus?.isDeployed && !droneStatus?.isReady}
              className={`pointer-events-auto border px-2 py-1 rounded flex items-center gap-1.5 transition-all active:scale-95 shadow-md cursor-pointer ${
                droneStatus?.isDeployed
                  ? 'bg-cyan-950/90 border-cyan-400 text-cyan-300 animate-pulse shadow-cyan-900/50'
                  : droneStatus?.isReady
                  ? 'bg-cyan-950/70 border-cyan-500/70 text-cyan-300 hover:bg-cyan-900/70'
                  : 'bg-black/60 border-zinc-800 text-zinc-600 opacity-50 cursor-not-allowed'
              }`}
              title="Deploy MQ-7 Combat Recon Drone [Y]"
            >
              <Radio className={`w-3.5 h-3.5 ${droneStatus?.isDeployed ? 'text-cyan-300 animate-spin' : 'text-cyan-400'}`} />
              <div className="flex flex-col items-start leading-tight">
                <span className="font-teko text-xs tracking-wider font-bold">DRONE [Y]</span>
                <span className="font-mono text-[9px] font-semibold">
                  {droneStatus?.isDeployed
                    ? `ACTIVE ${Math.ceil(droneStatus.batteryRemaining)}s`
                    : droneStatus?.cooldownRemaining && droneStatus.cooldownRemaining > 0
                    ? `RECHARGING ${Math.ceil(droneStatus.cooldownRemaining)}s`
                    : 'READY [30s]'}
                </span>
              </div>
            </button>
          )}

          {/* Ally Squad Order Toggle (Desktop only) */}
          {!isMobile && hasAllyRecruit && onToggleAllyOrder && (
            <button
              onClick={onToggleAllyOrder}
              className={`pointer-events-auto border px-2.5 py-1 rounded flex items-center gap-1.5 transition-all active:scale-95 shadow-md cursor-pointer ${
                allyOrder === 'FOLLOW_ME'
                  ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300 hover:bg-emerald-900/80'
                  : 'bg-amber-950/80 border-amber-500/80 text-amber-300 hover:bg-amber-900/80'
              }`}
              title="Toggle Squad Orders: Follow Me vs Move Forward & Search [C]"
            >
              {allyOrder === 'FOLLOW_ME' ? (
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Compass className="w-3.5 h-3.5 text-amber-400" />
              )}
              <div className="flex flex-col items-start leading-tight">
                <span className="font-teko text-xs tracking-wider font-bold">ALLIES [C]</span>
                <span className="font-mono text-[9px] font-semibold">
                  {allyOrder === 'FOLLOW_ME' ? 'FOLLOW-ME' : 'SEARCH AREA'}
                </span>
              </div>
            </button>
          )}

          {/* Melee Shove Button (Desktop) — anti-crowd escape move */}
          {!isMobile && (
            <button
              onClick={onShove}
              className="pointer-events-auto border px-2 py-1 rounded flex items-center gap-1.5 transition-all active:scale-95 shadow-md cursor-pointer bg-black/80 border-zinc-700 text-zinc-300 hover:border-sky-500/70 hover:text-sky-300"
              title="Shove nearby zombies away [V] — breaks out of swarms"
            >
              <Hand className="w-3.5 h-3.5 text-sky-400" />
              <div className="flex flex-col items-start leading-tight">
                <span className="font-teko text-xs tracking-wider font-bold">SHOVE [V]</span>
                <span className="font-mono text-[9px] font-semibold text-zinc-500">ESCAPE</span>
              </div>
            </button>
          )}

          {/* Tactical Flashlight Button (Desktop only) */}
          {!isMobile && (
            <button
              onClick={onToggleFlashlight}
              className={`pointer-events-auto border px-2 py-1 rounded flex items-center gap-1.5 transition-all active:scale-95 shadow-md cursor-pointer ${
                isFlashlightOn
                  ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-amber-500/20'
                  : 'bg-black/80 border-zinc-700 text-zinc-500 hover:text-zinc-300'
              }`}
              title="Toggle Tactical Flashlight [F]"
            >
              <Flashlight className={`w-3.5 h-3.5 ${isFlashlightOn ? 'text-amber-400' : 'text-zinc-500'}`} />
              <div className="flex flex-col items-start leading-tight">
                <span className="font-teko text-xs tracking-wider font-bold">LIGHT [F]</span>
                <span className="font-mono text-[9px] font-semibold">{isFlashlightOn ? 'ON' : 'OFF'}</span>
              </div>
            </button>
          )}

          {/* Tactical Flashlight Button (Mobile Header - Accessible & clean, removing it from movement thumb zone!) */}
          {isMobile && onToggleFlashlight && (
            <button
              onClick={onToggleFlashlight}
              className={`pointer-events-auto border p-1.5 rounded-md flex items-center justify-center transition-all active:scale-95 shadow-md ${
                isFlashlightOn
                  ? 'bg-amber-500/25 border-amber-400 text-amber-300'
                  : 'bg-black/75 border-zinc-700 text-zinc-500'
              }`}
              title="Toggle Tactical Flashlight"
              aria-label="Flashlight"
            >
              <Flashlight className={`w-4 h-4 ${isFlashlightOn ? 'text-amber-400' : 'text-zinc-500'}`} />
            </button>
          )}

          {/* Ammo Card */}
          <div className="bg-black/75 border border-zinc-800 px-2 py-0.5 sm:py-1 rounded shadow flex flex-col items-end">
            <span className="font-teko text-[9px] sm:text-xs text-zinc-400 uppercase tracking-wider">
              {player.weaponConfig.name}
            </span>
            {player.weaponConfig.melee ? (
              // Katana: no ammo — show an endless blade glyph
              <span className="font-teko text-lg sm:text-2xl font-bold tracking-tight text-cyan-300 leading-tight">∞</span>
            ) : player.weaponConfig.id === 'airstrike' ? (
              // Ordinance tablet: strike charges / cooldown instead of ammo
              <div className="flex items-baseline gap-1">
                <span
                  className={`font-teko text-lg sm:text-2xl font-bold tracking-tight ${
                    AirStrikeManager.getCharges() <= 0
                      ? 'text-red-500 animate-pulse'
                      : AirStrikeManager.getCooldown() > 0
                      ? 'text-amber-400'
                      : 'text-white'
                  }`}
                >
                  {AirStrikeManager.getCooldown() > 0
                    ? `${Math.ceil(AirStrikeManager.getCooldown())}s`
                    : AirStrikeManager.getCharges()}
                </span>
                <span className="font-military text-[9px] sm:text-xs text-zinc-500">
                  / {AirStrikeManager.getCharges()} STRIKE{AirStrikeManager.getCharges() === 1 ? '' : 'S'}
                </span>
              </div>
            ) : (
              <div className="flex items-baseline gap-1">
                <span
                  className={`font-teko text-lg sm:text-2xl font-bold tracking-tight ${
                    player.currentMag <= 3 ? 'text-red-500 animate-pulse' : 'text-white'
                  }`}
                >
                  {player.currentMag}
                </span>
                <span className="font-military text-[9px] sm:text-xs text-zinc-500">/ {player.reserveAmmo}</span>
              </div>
            )}
            {player.isReloading && (
              <span className="text-[8px] sm:text-[9px] font-military text-yellow-400 font-bold uppercase animate-pulse">
                RELOAD...
              </span>
            )}
          </div>

          {/* MENU BUTTON - ONLY HAMBURGER ICON */}
          <button
            onClick={onPause}
            className="pointer-events-auto bg-black/85 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-700 hover:border-red-500 p-1.5 sm:p-2.5 rounded-md text-zinc-100 hover:text-white transition-all active:scale-95 flex items-center justify-center shadow-lg shadow-black/60 min-h-[36px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px] touch-manipulation cursor-pointer"
            title="Open Combat Menu & Pause"
            aria-label="Menu"
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 shrink-0" />
          </button>
        </div>
      </div>

      {/* DYNAMIC KILL FEED — positioned above HUD on mobile, top-right on desktop */}
      {killFeed && killFeed.length > 0 && (
        <div className="absolute top-[max(env(safe-area-inset-top),4rem)] right-[max(env(safe-area-inset-right),0.5rem)] z-25 flex flex-col items-end gap-1 pointer-events-none max-w-[280px] sm:max-w-xs">
          {killFeed.slice(-5).map((kf) => (
            <div
              key={kf.id}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-mono backdrop-blur-md shadow-lg transition-all ${
                kf.isBoss
                  ? 'bg-amber-950/95 border-amber-500/90 text-amber-200 ring-1 ring-amber-500/50'
                  : kf.isHeadshot
                  ? 'bg-red-950/90 border-red-500/80 text-red-100'
                  : 'bg-black/85 border-zinc-700 text-zinc-200'
              }`}
            >
              <span className="font-bold text-sky-400 font-teko text-xs sm:text-sm tracking-wide shrink-0">
                {kf.killer}
              </span>
              <span className="text-[9px] sm:text-[10px] px-1 py-0.2 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono font-bold uppercase shrink-0">
                {kf.weapon}
              </span>
              {kf.isHeadshot && (
                <span className="text-red-400 font-black text-[9px] px-1 py-0.2 rounded bg-red-950/90 border border-red-500/60 shrink-0">
                  🎯 HS
                </span>
              )}
              <Skull className={`w-3 h-3 shrink-0 ${kf.isBoss ? 'text-amber-400 animate-pulse' : kf.isHeadshot ? 'text-red-400' : 'text-zinc-400'}`} />
              <span className={`font-teko text-xs sm:text-sm font-bold uppercase truncate ${kf.isBoss ? 'text-amber-400 font-black tracking-wider' : 'text-zinc-100'}`}>
                {kf.victim}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* BOSS HEALTH BAR */}
      {boss && !boss.isDead && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-52 sm:w-80 md:w-96 bg-black/85 border border-red-600/80 p-2 rounded shadow-2xl backdrop-blur-sm z-20">
          <div className="flex justify-between items-center text-xs font-teko text-red-500 tracking-wider font-bold mb-1">
            <span>MUTANT BOSS: {boss.config?.name?.toUpperCase() || 'THE COLOSSUS'}</span>
            <span>{Math.ceil((boss.hp / boss.maxHp) * 100)}%</span>
          </div>
          <div className="h-2.5 w-full bg-zinc-900 border border-zinc-800 rounded-xs overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-700 via-red-500 to-amber-500 transition-all duration-100"
              style={{ width: `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* COMBAT RECON DRONE FLIGHT HUD OVERLAY & ALTITUDE GAUGE */}
      {droneStatus?.isDeployed && (
        <div className="absolute inset-0 pointer-events-none z-15 flex flex-col justify-between p-3 sm:p-6">
          {/* Top Flight Bar */}
          <div className="flex items-center justify-between mx-auto w-full max-w-xl bg-black/85 border border-cyan-500/70 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg shadow-xl shadow-cyan-950/40 backdrop-blur-xs">
            <div className="flex items-center gap-2">
              <Plane className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
              <div className="flex flex-col">
                <span className="font-teko text-xs sm:text-sm font-bold text-cyan-300 tracking-wider">
                  UAV RECON STRIKE DRONE
                </span>
                <span className="font-mono text-[8px] sm:text-[9px] text-cyan-400/80">
                  TACTICAL AIR-TO-GROUND ROCKETS &bull; STABILIZED
                </span>
              </div>
            </div>

            {/* Drone Altitude Gauge */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex flex-col items-end">
                <div className="flex items-baseline gap-1">
                  <span className="font-teko text-sm sm:text-base font-black text-cyan-200">
                    ALT {((droneStatus.altitude || 12)).toFixed(1)}m
                  </span>
                  <span className="font-mono text-[8px] sm:text-[9px] text-zinc-400">
                    [TGT: {(droneStatus.targetAltitude || 12).toFixed(1)}m]
                  </span>
                </div>
                {/* Visual Altitude Ladder Bar (4m to 28m range) */}
                <div className="w-24 sm:w-32 h-1.5 sm:h-2 bg-zinc-900 border border-cyan-700/60 rounded-xs overflow-hidden flex">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-600 to-cyan-300 transition-all duration-100"
                    style={{
                      width: `${Math.max(0, Math.min(100, (((droneStatus.altitude || 12) - 4) / 24) * 100))}%`
                    }}
                  />
                </div>
              </div>

              {/* Battery Indicator */}
              <div className="flex flex-col items-center bg-cyan-950/60 border border-cyan-500/50 px-1.5 sm:px-2 py-0.5 rounded">
                <span className="font-teko text-[9px] sm:text-[10px] text-cyan-400 font-bold">BATTERY</span>
                <span className="font-mono text-[11px] sm:text-xs font-black text-cyan-200">
                  {Math.ceil(droneStatus.batteryRemaining)}s
                </span>
              </div>
            </div>
          </div>

          {/* Center Tactical HUD Target Reticle */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-40 h-40 sm:w-48 sm:h-48 border border-cyan-400/25 rounded-full flex items-center justify-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 border border-cyan-400/40 rounded-full animate-ping opacity-25" />
              <div className="absolute top-3 font-mono text-[8px] sm:text-[9px] text-cyan-400 tracking-wider">RECON CAM - ROCKET PODS [READY]</div>
              <div className="absolute bottom-3 font-mono text-[8px] sm:text-[9px] text-cyan-400">
                ALT: {((droneStatus.altitude || 12)).toFixed(1)}M
              </div>
            </div>
          </div>

          {/* Desktop Altitude Flight Key Guide */}
          {!isMobile && (
            <div className="mx-auto bg-black/85 border border-cyan-500/60 px-3 py-1 rounded-full text-cyan-300 font-mono text-[9px] sm:text-[10px] tracking-wider flex items-center gap-2 shadow-lg backdrop-blur-xs">
              <span className="text-cyan-400 font-bold">[SPACE / E] ASCEND ▲</span>
              <span>&bull;</span>
              <span className="text-cyan-400 font-bold">[SHIFT / Q / C] DESCEND ▼</span>
              <span>&bull;</span>
              <span>[WASD] MOVE</span>
              <span>&bull;</span>
              <span className="text-amber-400 font-bold">[LEFT CLICK] LAUNCH ROCKETS 🚀</span>
            </div>
          )}
        </div>
      )}

      {/* SNIPER SCOPE OVERLAY — circular masked zoom optic */}
      {player.isScoped && (
        <div className="absolute inset-0 z-30 pointer-events-none">
          {/* Black mask with a circular cutout for the optic */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0, rgba(0,0,0,0) min(37vh,37vw), rgba(0,0,0,0.97) calc(min(37vh,37vw) + 2px))',
            }}
          />
          {/* Optic ring with inner shadow */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[5px] border-black/95"
            style={{
              width: 'min(74vh,74vw)',
              height: 'min(74vh,74vw)',
              boxShadow: 'inset 0 0 70px rgba(0,0,0,0.9), 0 0 24px rgba(0,0,0,0.8)',
            }}
          />
          {/* Reticle: full hairlines + mil ticks + center dot */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ width: 'min(72vh,72vw)', height: 'min(72vh,72vw)' }}
          >
            <div className="absolute left-0 right-0 top-1/2 h-px bg-black/90 -translate-y-1/2" />
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-black/90 -translate-x-1/2" />
            {/* mil ticks along the horizontal */}
            {[-0.32, -0.24, -0.16, -0.08, 0.08, 0.16, 0.24, 0.32].map((frac) => (
              <div
                key={frac}
                className="absolute top-1/2 -translate-y-1/2 w-px h-[10px] bg-black/85"
                style={{ left: `${50 + frac * 100}%` }}
              />
            ))}
            {/* range chevrons below center */}
            {[-0.1, -0.18, -0.26].map((frac, i) => (
              <div
                key={frac}
                className="absolute left-1/2 -translate-x-1/2 w-[10px] h-px bg-red-600/80"
                style={{ top: `${50 - frac * 100}%` }}
              >
                <span className="absolute left-3 -top-1 font-mono text-[7px] text-red-500/90">{(i + 1) * 100}</span>
              </div>
            ))}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)]" />
          </div>
        </div>
      )}

      {/* ROCKET LAUNCHER NIGHT VISION SCOPE OVERLAY — green phosphor optic */}
      {player.isNightVision && (
        <div className="absolute inset-0 z-30 pointer-events-none">
          {/* Green phosphor overlay */}
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at 50% 50%, rgba(0,40,0,0.3) 0%, rgba(0,10,0,0.85) 60%, rgba(0,5,0,0.95) 100%)',
            }}
          />
          {/* Scanline overlay for CRT effect */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,255,0,0.03) 1px, rgba(0,255,0,0.03) 2px)',
              opacity: 0.6,
              animation: 'scanline 0.1s linear infinite',
            }}
          />
          <style jsx>{`
            @keyframes scanline {
              0% { transform: translateY(0); }
              100% { transform: translateY(2px); }
            }
          `}</style>
          {/* Vignette */}
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.7) 100%)',
            }}
          />
          {/* Optic frame */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[4px] border-green-400/60"
            style={{
              width: 'min(70vh,70vw)',
              height: 'min(70vh,70vw)',
              boxShadow: 'inset 0 0 80px rgba(0,255,0,0.3), 0 0 30px rgba(0,255,0,0.2)',
            }}
          />
          {/* Reticle: crosshair with range markers */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ width: 'min(68vh,68vw)', height: 'min(68vh,68vw)' }}
          >
            {/* Horizontal line */}
            <div className="absolute left-0 right-0 top-1/2 h-px bg-green-400/90 -translate-y-1/2" />
            {/* Vertical line */}
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-green-400/90 -translate-x-1/2" />
            {/* Range brackets */}
            {[-0.25, -0.15, -0.05, 0.05, 0.15, 0.25].map((frac, i) => (
              <div
                key={frac}
                className="absolute top-1/2 -translate-y-1/2 w-[24px] h-px bg-green-400/80"
                style={{ left: `${50 + frac * 100}%` }}
              >
                <span className="absolute left-4 -top-1.5 font-mono text-[7px] text-green-300/90">{Math.round(100 + i * 50)}m</span>
              </div>
            ))}
            {/* Center dot */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-green-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
          </div>
          {/* NVG UI elements - top corners */}
          <div className="absolute top-4 left-4 flex flex-col gap-1 text-green-400/80 font-mono text-[8px]">
            <div>NVG MODE ACTIVE</div>
            <div>THERMAL: ON</div>
            <div>GAIN: AUTO</div>
          </div>
          <div className="absolute top-4 right-4 text-right text-green-400/80 font-mono text-[8px]">
            <div>RANGE: 120m</div>
            <div>AMMO: {player.currentMag}/{player.reserveAmmo}</div>
          </div>
        </div>
      )}

      {/* CENTER CROSSHAIR & CRITICAL FEEDBACK (hidden while the sniper scope is up) */}
      {!player.isScoped && (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-8 h-8 flex items-center justify-center">
          <div className="w-1 h-1 bg-white/80 rounded-full shadow-sm shadow-black" />
          <div className="absolute top-0 w-0.5 h-2 bg-white/70" />
          <div className="absolute bottom-0 w-0.5 h-2 bg-white/70" />
          <div className="absolute left-0 h-0.5 w-2 bg-white/70" />
          <div className="absolute right-0 h-0.5 w-2 bg-white/70" />

          {showHit && !isHeadshot && (
            <div className="absolute w-5 h-5 border-t-2 border-r-2 border-white rotate-45 animate-ping opacity-90" />
          )}

          {showHit && isHeadshot && (
            <div className="absolute flex flex-col items-center justify-center animate-bounce">
              <Skull className="w-6 h-6 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
              <span className="font-teko text-[11px] font-bold text-red-400 tracking-wider">HEADSHOT</span>
            </div>
          )}
        </div>
      </div>
      )}

      {/* INTERACTIVE OBJECT PROMPT */}
      {curObj && curObj.type === 'interact_object' && dist !== null && dist <= 6.0 && (
        <div
          className="absolute bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 rounded-lg font-military text-sm font-black shadow-2xl border-2 border-yellow-200 animate-bounce pointer-events-auto cursor-pointer flex items-center gap-2 transition-all active:scale-95 z-30"
          onClick={onInteract}
        >
          <span className="bg-black text-amber-400 px-1.5 py-0.5 rounded text-xs font-bold">{isMobile ? 'TAP' : '[E]'}</span>
          <span>{curObj.title || 'INTERACT'}</span>
        </div>
      )}

      {/* LAPTOP / DESKTOP QUICK WEAPON SWITCHER BAR */}
      {!isMobile && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/85 border border-zinc-800 p-1.5 rounded-lg shadow-xl backdrop-blur-xs pointer-events-auto">
          {/* Quick Swap Secondary Button [Q] */}
          <button
            onClick={onSwitchWeapon}
            className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-red-500/70 px-2.5 py-1 rounded text-zinc-200 active:scale-95 transition-all cursor-pointer"
            title="Quick-Swap to Secondary Weapon [Q] or Mouse Wheel"
          >
            <RefreshCw className="w-3.5 h-3.5 text-red-400" />
            <span className="font-teko text-xs font-bold text-red-400">[Q] SWAP WEAPON</span>
          </button>

          {/* Unlocked Weapon Slots */}
          <div className="flex items-center gap-1 border-l border-zinc-800 pl-1.5">
            {(['pistol', 'shotgun', 'rifle', 'smg', 'heavy', 'sniper', 'rocket', 'katana', 'airstrike'] as WeaponTypeKey[]).map((wKey, idx) => {
              const isUnlocked = unlockedWeapons.includes(wKey);
              const isEquipped = player.weaponConfig.id === wKey;
              if (!isUnlocked) return null;

              return (
                <button
                  key={wKey}
                  onClick={() => onSelectWeapon?.(wKey)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                    isEquipped
                      ? 'bg-red-600 text-white shadow-sm shadow-red-500/50'
                      : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                  }`}
                  title={`[${idx + 1}] Equip ${wKey.toUpperCase()}`}
                >
                  <span className="text-[8px] text-zinc-500 mr-0.5">{idx + 1}:</span>
                  <span>{wKey.toUpperCase()}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* MOBILE RADIAL WEAPON DIAL — 5 tactical sections around a center fire button */}
      {isMobile && (
        <div className="absolute right-[max(env(safe-area-inset-right),0.4rem)] bottom-[max(env(safe-area-inset-bottom),0.4rem)] z-20 pointer-events-none select-none">
          {/* Drone altitude shifter (when the UAV is airborne) */}
          {hasDrone && droneStatus?.isDeployed && (
            <div className="flex justify-end mb-1.5 pr-3 pointer-events-auto">
              <div className="flex items-center bg-cyan-950/90 border border-cyan-500/70 rounded-full p-0.5 shadow-lg">
                <button
                  onClick={onDroneAscend}
                  className="w-8 h-8 rounded-full bg-cyan-900/90 hover:bg-cyan-800 text-cyan-200 flex items-center justify-center active:scale-90"
                  title="Ascend Altitude"
                >
                  <ArrowUp className="w-4 h-4 text-cyan-300" />
                </button>
                <span className="font-mono text-[9px] text-cyan-300 font-bold px-1 whitespace-nowrap">
                  {Math.round(droneStatus.altitude || 12)}m
                </span>
                <button
                  onClick={onDroneDescend}
                  className="w-8 h-8 rounded-full bg-cyan-900/90 hover:bg-cyan-800 text-cyan-200 flex items-center justify-center active:scale-90"
                  title="Descend Altitude"
                >
                  <ArrowDown className="w-4 h-4 text-cyan-300" />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-end gap-3">
            {/* Movement utilities column (clearly separated from the dial) */}
            <div className="flex flex-col gap-2 pointer-events-auto mb-1.5">
              <button
                onClick={onJump}
                className="w-11 h-11 rounded-full bg-black/60 border border-sky-400/70 backdrop-blur-xs flex flex-col items-center justify-center text-sky-400 active:scale-95 shadow-md"
                title="Jump"
              >
                <ArrowUp className="w-4 h-4" />
                <span className="font-teko text-[8px] font-bold leading-none">JUMP</span>
              </button>

              <button
                onClick={onSwitchWeapon}
                className="w-11 h-11 rounded-full bg-black/60 border border-amber-500/70 backdrop-blur-xs flex flex-col items-center justify-center text-amber-300 active:scale-95 shadow-md"
                title="Swap Weapon"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-teko text-[8px] font-bold leading-none text-amber-300">SWAP</span>
              </button>

              <button
                onClick={onReload}
                className="w-11 h-11 rounded-full bg-black/60 border border-yellow-500/80 backdrop-blur-xs flex flex-col items-center justify-center text-yellow-400 active:scale-95 shadow-md"
                title="Reload Magazine"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="text-[9px] font-mono leading-none mt-0.5">
                  {player.weaponConfig.melee
                    ? '∞'
                    : player.weaponConfig.id === 'airstrike'
                    ? AirStrikeManager.getCharges()
                    : player.currentMag}
                </span>
              </button>
            </div>

            {/* THE RADIAL DIAL — 6 sections placed by trig on a 66px ring so
                every button sits fully inside the dial (no edge overflow) */}
            <div className="relative w-[200px] h-[200px] pointer-events-auto">
              {/* dial base */}
              <div className="absolute inset-0 rounded-full bg-black/50 border-2 border-zinc-700/80 shadow-2xl shadow-black/70 backdrop-blur-[2px]" />
              <div className="absolute inset-[30px] rounded-full border border-cyan-400/20 bg-[radial-gradient(circle,rgba(8,145,178,0.12)_0%,rgba(0,0,0,0)_70%)]" />

              {/* GRENADE (0° — top, green) */}
              <button
                onClick={onThrowGrenade}
                disabled={grenadesCount <= 0}
                className={`absolute w-[54px] h-[54px] rounded-2xl border-2 bg-zinc-950/90 backdrop-blur-[2px] flex flex-col items-center justify-center active:scale-95 transition-all shadow-lg ${
                  grenadesCount > 0
                    ? 'border-emerald-400/80 text-emerald-300 shadow-emerald-900/50'
                    : 'border-zinc-700 text-zinc-600 opacity-50'
                }`}
                style={{ left: 73, top: 7 }}
                title="Throw Frag Grenade"
              >
                <Bomb className="w-4 h-4" />
                <span className="font-teko text-[8px] font-bold tracking-wider leading-none mt-0.5">GRENADE</span>
                <span className="absolute -top-1 -right-1 bg-emerald-600 text-white font-mono text-[8px] min-w-[14px] h-[14px] px-0.5 rounded-full flex items-center justify-center font-bold">
                  {grenadesCount}
                </span>
              </button>

              {/* TURRET (60° — upper right, blue) */}
              <button
                onClick={onDeployTurret}
                disabled={turretsCount <= 0}
                className={`absolute w-[54px] h-[54px] rounded-2xl border-2 bg-zinc-950/90 backdrop-blur-[2px] flex flex-col items-center justify-center active:scale-95 transition-all shadow-lg ${
                  turretsCount > 0
                    ? 'border-sky-400/80 text-sky-300 shadow-sky-900/50'
                    : 'border-zinc-700 text-zinc-600 opacity-50'
                }`}
                style={{ left: 130.2, top: 40 }}
                title="Deploy Sentry Turret"
              >
                <Shield className="w-4 h-4" />
                <span className="font-teko text-[8px] font-bold tracking-wider leading-none mt-0.5">TURRET</span>
                <span className="absolute -top-1 -right-1 bg-sky-600 text-white font-mono text-[8px] min-w-[14px] h-[14px] px-0.5 rounded-full flex items-center justify-center font-bold">
                  {turretsCount}
                </span>
              </button>

              {/* DRONE (120° — lower right, purple) */}
              {hasDrone && onDeployDrone && (
                <button
                  onClick={onDeployDrone}
                  disabled={!droneStatus?.isDeployed && !droneStatus?.isReady}
                  className={`absolute w-[54px] h-[54px] rounded-2xl border-2 bg-zinc-950/90 backdrop-blur-[2px] flex flex-col items-center justify-center active:scale-95 transition-all shadow-lg ${
                    droneStatus?.isDeployed
                      ? 'border-purple-300 text-purple-200 animate-pulse shadow-purple-900/60'
                      : droneStatus?.isReady
                      ? 'border-purple-400/80 text-purple-300 shadow-purple-900/50'
                      : 'border-zinc-700 text-zinc-600 opacity-50'
                  }`}
                  style={{ left: 130.2, top: 106 }}
                  title="Deploy / Recall Combat Drone"
                >
                  <Radio className="w-4 h-4" />
                  <span className="font-teko text-[8px] font-bold tracking-wider leading-none mt-0.5">DRONE</span>
                  {droneStatus?.isDeployed && (
                    <span className="absolute -top-1 -right-1 bg-purple-500 text-white font-mono text-[8px] min-w-[14px] h-[14px] px-0.5 rounded-full flex items-center justify-center font-bold">
                      {Math.ceil(droneStatus.batteryRemaining)}
                    </span>
                  )}
                </button>
              )}

              {/* ALLIES (180° — bottom, yellow) */}
              {hasAllyRecruit && onToggleAllyOrder && (
                <button
                  onClick={onToggleAllyOrder}
                  className="absolute w-[54px] h-[54px] rounded-2xl border-2 border-yellow-400/80 bg-zinc-950/90 backdrop-blur-[2px] flex flex-col items-center justify-center text-yellow-300 active:scale-95 transition-all shadow-lg shadow-yellow-900/40"
                  style={{ left: 73, top: 139 }}
                  title={`Squad Order: ${allyOrder === 'FOLLOW_ME' ? 'Follow Me' : 'Search & Attack'}`}
                >
                  <Users className="w-4 h-4" />
                  <span className="font-teko text-[8px] font-bold tracking-wider leading-none mt-0.5">
                    {allyOrder === 'FOLLOW_ME' ? 'FOLLOW' : 'SEARCH'}
                  </span>
                </button>
              )}

              {/* FLASHLIGHT (240° — lower left, red) */}
              {onToggleFlashlight && (
                <button
                  onClick={onToggleFlashlight}
                  className={`absolute w-[54px] h-[54px] rounded-2xl border-2 bg-zinc-950/90 backdrop-blur-[2px] flex flex-col items-center justify-center active:scale-95 transition-all shadow-lg ${
                    isFlashlightOn
                      ? 'border-red-400/80 text-red-300 shadow-red-900/50'
                      : 'border-zinc-700 text-zinc-500'
                  }`}
                  style={{ left: 15.8, top: 106 }}
                  title="Toggle Tactical Flashlight"
                >
                  <Flashlight className="w-4 h-4" />
                  <span className="font-teko text-[8px] font-bold tracking-wider leading-none mt-0.5">LIGHT</span>
                </button>
              )}

              {/* AIR STRIKE TABLET (300° — upper left, orange) — swaps to the
                  ordinance designator; raise it again over a live turret to strike */}
              {unlockedWeapons.includes('airstrike') && (
                <button
                  onClick={() => onSelectWeapon?.('airstrike')}
                  className={`absolute w-[54px] h-[54px] rounded-2xl border-2 bg-zinc-950/90 backdrop-blur-[2px] flex flex-col items-center justify-center active:scale-95 transition-all shadow-lg ${
                    player.weaponConfig.id === 'airstrike'
                      ? 'border-orange-300 text-orange-200 animate-pulse shadow-orange-900/60'
                      : 'border-orange-500/70 text-orange-300 shadow-orange-900/40'
                  }`}
                  style={{ left: 15.8, top: 40 }}
                  title="Ordinance Tablet — requires an active Sentry Turret uplink"
                >
                  <Crosshair className="w-4 h-4" />
                  <span className="font-teko text-[8px] font-bold tracking-wider leading-none mt-0.5">STRIKE</span>
                </button>
              )}

              {/* CENTER: FIRE BUTTON */}
              <div
                id="mobile-shoot-btn"
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[68px] h-[68px] rounded-full bg-red-600/40 hover:bg-red-600/55 active:bg-red-600/85 border-[3px] border-red-400/80 backdrop-blur-[3px] flex items-center justify-center cursor-pointer transition-colors"
                style={{ boxShadow: '0 0 18px rgba(239,68,68,0.45), inset 0 0 14px rgba(59,130,246,0.28)' }}
              >
                <Crosshair className="w-7 h-7 text-white/90 drop-shadow" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
