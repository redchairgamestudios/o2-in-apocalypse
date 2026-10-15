import React, { useEffect, useState } from 'react';
// Use public/ path for stable URL that works with PWA caching on Vercel
const loadingScreenImg = '/loading-screen.png';

interface LoadingScreenProps {
  onComplete: (missionId: number) => void;
  missionId: number;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete, missionId }) => {
  const [progress, setProgress] = useState(0);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    // Guard: don't start loading until we have a valid missionId
    if (!missionId || missionId < 1) return;

    // Minimum display time: 10-20 seconds
    const minDisplayTime = 10000 + Math.random() * 10000;
    const minTimer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, minDisplayTime);

    // Animated progress bar (visual only - assets already loaded in App.tsx init)
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + Math.random() * 15;
        if (next >= 95) {
          clearInterval(progressInterval);
          return 95;
        }
        return next;
      });
    }, 800);

    // Safety timeout - force complete after 25 seconds max
    const safetyTimer = setTimeout(() => {
      console.warn('[LoadingScreen] Safety timeout reached, forcing completion');
      setMinTimeElapsed(true);
      setProgress(100);
      clearInterval(progressInterval);
    }, 25000);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(safetyTimer);
      clearInterval(progressInterval);
    };
  }, [missionId]);

  useEffect(() => {
    // Complete when min time elapsed AND progress reached near 100%
    if (minTimeElapsed && progress >= 95) {
      // Final quick animation to 100%
      const finalTimer = setTimeout(() => {
        setProgress(100);
        setTimeout(() => onComplete(missionId), 300);
      }, 200);
      return () => clearTimeout(finalTimer);
    }
  }, [minTimeElapsed, progress, onComplete, missionId]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black overflow-hidden">
      {/* Full-screen background image */}
      <img
        src={loadingScreenImg}
        alt="Loading"
        className="absolute inset-0 w-full h-full object-cover opacity-90"
        style={{ filter: 'brightness(0.7) contrast(1.1)' }}
      />
      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />

      {/* Scanline overlay for atmospheric effect */}
      <div className="absolute inset-0 z-10 pointer-events-none opacity-30" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
      }} />

      {/* Film grain */}
      <div className="absolute inset-0 z-10 pointer-events-none opacity-10" style={{
        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
      }} />

      {/* Loading content — safe-area padded and scrollable so nothing is
          truncated on short viewports / camera cutouts (my-auto keeps it
          centered while still allowing scroll when it overflows) */}
      <div className="absolute inset-0 z-20 overflow-y-auto overscroll-contain safe-pad-y flex flex-col">
        <div className="my-auto flex flex-col items-center justify-center text-center px-6">
        {/* Mission title */}
        <div className="mb-8 short:mb-3">
          <div className="font-mono text-[10px] text-red-500 uppercase tracking-widest font-bold mb-2 animate-pulse">
            INITIALIZING OPERATION
          </div>
          <h1 className="font-teko text-4xl md:text-6xl lg:text-7xl short:text-3xl font-bold text-white tracking-wider leading-none drop-shadow-[0_0_30px_rgba(255,23,23,0.8)]">
            MISSION {missionId.toString().padStart(2, '0')}
          </h1>
          <p className="font-military text-sm md:text-base text-zinc-300 mt-2 tracking-wider">
            {getMissionTitle(missionId)}
          </p>
        </div>

        {/* Loading bar */}
        <div className="w-full max-w-xl mx-auto mb-6">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-2 tracking-wider">
            <span>ASSET STREAMING</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="relative h-3 bg-zinc-900 border border-zinc-700 rounded-full overflow-hidden shadow-inner">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-600 via-red-400 to-amber-400 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
            {/* Glow effect on progress bar */}
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-full"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        {/* Status text */}
        <div className="font-military text-xs text-zinc-400 mb-4 min-h-[20px] flex items-center justify-center gap-2">
          <span className="animate-pulse">●</span>
          <span>{getLoadingStatus(progress)}</span>
        </div>

        {/* Tactical tips while loading */}
        <div className="w-full max-w-md text-left bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-4 short:p-2.5 backdrop-blur-sm short:hidden sm:short:block">
          <div className="font-teko text-sm text-amber-400 tracking-wider mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            TACTICAL BRIEFING
          </div>
          <p className="font-military text-[11px] text-zinc-300 leading-relaxed">
            {getRandomTip()}
          </p>
        </div>

        {/* Minimum time indicator */}
        {!minTimeElapsed && (
          <div className="mt-6 font-mono text-[10px] text-zinc-500 tracking-wider animate-pulse">
            STABILIZING DROP POD...
          </div>
        )}

        {minTimeElapsed && progress < 95 && (
          <div className="mt-6 font-mono text-[10px] text-emerald-400 tracking-wider">
            ASSETS LOADED • AWAITING DEPLOYMENT WINDOW
          </div>
        )}

        {minTimeElapsed && progress >= 95 && (
          <div className="mt-6 font-mono text-[10px] text-emerald-400 tracking-wider animate-pulse">
            DEPLOYMENT AUTHORIZED • INSERTION IMMINENT
          </div>
        )}
        </div>
      </div>

      {/* Corner brackets for tactical aesthetic */}
      <div className="absolute top-4 left-4 w-8 h-8 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-red-500/60" />
        <div className="absolute top-0 left-0 h-full w-[2px] bg-red-500/60" />
      </div>
      <div className="absolute top-4 right-4 w-8 h-8 pointer-events-none">
        <div className="absolute top-0 right-0 w-full h-[2px] bg-red-500/60" />
        <div className="absolute top-0 right-0 h-full w-[2px] bg-red-500/60" />
      </div>
      <div className="absolute bottom-4 left-4 w-8 h-8 pointer-events-none">
        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-red-500/60" />
        <div className="absolute bottom-0 left-0 h-full w-[2px] bg-red-500/60" />
      </div>
      <div className="absolute bottom-4 right-4 w-8 h-8 pointer-events-none">
        <div className="absolute bottom-0 right-0 w-full h-[2px] bg-red-500/60" />
        <div className="absolute bottom-0 right-0 h-full w-[2px] bg-red-500/60" />
      </div>
    </div>
  );
};

function getMissionTitle(missionId: number): string {
  const titles: Record<number, string> = {
    1: 'QUARANTINE ZONE // INITIAL CONTAINMENT',
    2: 'FREIGHT DEPOT // SUPPLY LINE INTERDICTION',
    3: 'CHECKPOINT BRAVO // PERIMETER BREACH',
    4: 'SUBSTATION ALPHA // POWER GRID RESTORATION',
    5: 'AIRFIELD HANGAR // AERIAL ASSET RECOVERY',
    6: 'CENTRAL PLAZA // CIVILIAN EVACUATION',
    7: 'INDUSTRIAL SECTOR // FACTORY CLEARANCE',
    8: 'UNDERGROUND TRANSIT // TUNNEL RAT OPERATIONS',
    9: 'COMMAND BUNKER // HIGH-VALUE TARGET ELIMINATION',
    10: 'GROUND ZERO RUNWAY // FINAL EXTRACTION',
  };
  return titles[missionId] || 'CLASSIFIED OPERATION';
}

function getLoadingStatus(progress: number): string {
  if (progress < 20) return 'STREAMING ZOMBIE ROSTER...';
  if (progress < 40) return 'LOADING BOSS SCULPT...';
  if (progress < 55) return 'PREPARING HELICOPTER ASSET...';
  if (progress < 70) return 'INITIALIZING SQUAD CHARACTER...';
  if (progress < 85) return 'BUILDING HEAVY WEAPON...';
  if (progress < 100) return 'GENERATING MISSION ENVIRONMENT...';
  return 'DEPLOYMENT READY';
}

const tips = [
  'HEADSHOTS DEAL 3× DAMAGE. AIM FOR THE CRANIUM.',
  'ROCKET LAUNCHER BACKBLAST IS LETHAL AT CLOSE RANGE. CLEAR YOUR SIX.',
  'FLASHLIGHT REVEALS WEAK POINTS BUT ATTRACTS HORDES. USE TACTICALLY.',
  'ALLIES AUTO-UPGRADE TO YOUR HIGHEST TIER WEAPON. EQUIP WISELY.',
  'SNIPER SCOPE DROPS ON RELOAD. CHAMBER A ROUND BEFORE ENGAGING.',
  'GRENADES STAGGER COLOSSEI. COOK THEM FOR AIR BURSTS.',
  'TURRETS PROVIDE 360° COVERAGE. DEPLOY ON HIGH GROUND.',
  'DRONE BATTERY DRAINS FAST. RECALL BEFORE CRITICAL.',
  'RADAR PULSES RED WHEN 10+ HOSTILES WITHIN 42M. WATCH YOUR FLANKS.',
  'ROCKET IMPACT CREATES BURNING GROUND. ZOMBIES TAKE DOT IN FIRE.',
];

function getRandomTip(): string {
  return tips[Math.floor(Math.random() * tips.length)];
}