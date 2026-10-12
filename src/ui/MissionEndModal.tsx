import React from 'react';
import { GameStats, MissionConfig } from '../types';
import {
  Trophy,
  Skull,
  Crosshair,
  DollarSign,
  Clock,
  RotateCcw,
  Wrench,
  ChevronRight,
  Home,
  Star,
  Target,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

interface MissionEndModalProps {
  isVictory: boolean;
  mission: MissionConfig;
  stats: GameStats;
  isMobile?: boolean;
  onNextMission?: () => void;
  onRetry: () => void;
  onOpenArsenal: () => void;
  onMainMenu: () => void;
}

export const MissionEndModal: React.FC<MissionEndModalProps> = ({
  isVictory,
  mission,
  stats,
  isMobile = false,
  onNextMission,
  onRetry,
  onOpenArsenal,
  onMainMenu,
}) => {
  const accuracy = stats.shotsFired > 0 ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 0;
  const minutes = Math.floor(stats.missionTime / 60);
  const seconds = Math.floor(stats.missionTime % 60);
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  // Calculate combat rank & star rating (1 to 3 stars)
  let stars = 1;
  let rank = 'C';
  let rankColor = 'text-zinc-400';
  if (isVictory) {
    if (accuracy >= 65 && stats.headshots >= 3) {
      stars = 3;
      rank = 'S';
      rankColor = 'text-amber-400';
    } else if (accuracy >= 40 || stats.headshots >= 2) {
      stars = 2;
      rank = 'A';
      rankColor = 'text-emerald-400';
    } else {
      stars = 1;
      rank = 'B';
      rankColor = 'text-blue-400';
    }
  }

  return (
    <div className="absolute inset-0 z-50 bg-black/92 backdrop-blur-lg flex items-center justify-center p-2 sm:p-4 md:p-8 pointer-events-auto overflow-y-auto">
      <div className="bg-zinc-950/98 border border-zinc-800/90 rounded-2xl max-w-sm sm:max-w-md md:max-w-lg w-full p-3 sm:p-6 md:p-8 short:p-2 shadow-2xl relative overflow-hidden short:overflow-y-auto my-auto max-h-[96vh] flex flex-col justify-between">
        {/* Glow Header Accent Line */}
        <div
          className={`absolute top-0 inset-x-0 h-1.5 sm:h-2 ${
            isVictory
              ? 'bg-gradient-to-r from-emerald-500 via-green-400 to-teal-500'
              : 'bg-gradient-to-r from-red-600 via-rose-500 to-red-700'
          }`}
        />

        {/* Top Header: Badge & Status */}
        <div className="text-center pt-0.5 sm:pt-1 mb-2 sm:mb-4">
          <div className="flex items-center justify-center gap-2 mb-1 sm:mb-2">
            {isVictory ? (
              <div className="relative flex items-center justify-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 short:w-10 short:h-10 rounded-full bg-emerald-950/90 border-2 border-emerald-400 flex items-center justify-center shadow-xl shadow-emerald-900/50">
                  <Trophy className="w-6 h-6 sm:w-8 sm:h-8 short:w-5 short:h-5 text-emerald-400 animate-pulse" />
                </div>
                {/* Tactical Rank Stamp */}
                <div className={`absolute -bottom-1 -right-1 font-teko text-xs sm:text-base font-black bg-black/95 px-1.5 py-0.2 rounded-md border border-zinc-700 ${rankColor} shadow-md`}>
                  RANK {rank}
                </div>
              </div>
            ) : (
              <div className="relative flex items-center justify-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 short:w-10 short:h-10 rounded-full bg-red-950/90 border-2 border-red-500 flex items-center justify-center shadow-xl shadow-red-950/80">
                  <Skull className="w-6 h-6 sm:w-8 sm:h-8 short:w-5 short:h-5 text-red-500" />
                </div>
                <div className="absolute -bottom-1 -right-1 font-teko text-xs sm:text-sm font-black bg-black/95 px-1.5 py-0.2 rounded-md border border-red-800 text-red-400 shadow-md">
                  KIA
                </div>
              </div>
            )}
          </div>

          <h2
            className={`font-teko text-2xl sm:text-4xl md:text-5xl short:text-xl font-black tracking-wider leading-none mb-0.5 sm:mb-1 ${
              isVictory ? 'text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.5)]' : 'text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]'
            }`}
          >
            {isVictory ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED'}
          </h2>

          <div className="flex items-center justify-center gap-1.5 sm:gap-2">
            <span className="font-mono text-[9px] sm:text-xs text-zinc-400 uppercase tracking-wider font-bold truncate max-w-[200px] sm:max-w-none">
              {mission.title}
            </span>
            {isVictory && (
              <div className="flex items-center gap-0.5 ml-1">
                {[1, 2, 3].map((starIdx) => (
                  <Star
                    key={starIdx}
                    className={`w-3 h-3 sm:w-4 sm:h-4 ${
                      starIdx <= stars
                        ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]'
                        : 'text-zinc-700'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Combat Debrief Stats Grid - 4-pill responsive layout */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 mb-2.5 sm:mb-4 short:mb-1.5 bg-zinc-900/90 p-2 sm:p-3 rounded-xl border border-zinc-800/90 shadow-inner font-military">
          {/* Kills */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-black/60 p-1.5 sm:p-2 rounded-lg border border-zinc-800/80">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-red-950/70 border border-red-500/40 flex items-center justify-center shrink-0">
              <Skull className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-400" />
            </div>
            <div>
              <div className="text-[7px] sm:text-[9px] text-zinc-400 uppercase font-mono leading-none">KILLS</div>
              <div className="font-teko text-base sm:text-xl font-bold text-white leading-none mt-0.5">{stats.kills}</div>
            </div>
          </div>

          {/* Headshots */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-black/60 p-1.5 sm:p-2 rounded-lg border border-zinc-800/80">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-amber-950/70 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Crosshair className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
            </div>
            <div>
              <div className="text-[7px] sm:text-[9px] text-zinc-400 uppercase font-mono leading-none">HEADSHOTS</div>
              <div className="font-teko text-base sm:text-xl font-bold text-amber-400 leading-none mt-0.5">{stats.headshots}</div>
            </div>
          </div>

          {/* Accuracy */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-black/60 p-1.5 sm:p-2 rounded-lg border border-zinc-800/80">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-sky-950/70 border border-sky-500/40 flex items-center justify-center shrink-0">
              <Target className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-400" />
            </div>
            <div>
              <div className="text-[7px] sm:text-[9px] text-zinc-400 uppercase font-mono leading-none">ACCURACY</div>
              <div className="font-teko text-base sm:text-xl font-bold text-sky-300 leading-none mt-0.5">{accuracy}%</div>
            </div>
          </div>

          {/* Time */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-black/60 p-1.5 sm:p-2 rounded-lg border border-zinc-800/80">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-indigo-950/70 border border-indigo-500/40 flex items-center justify-center shrink-0">
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-400" />
            </div>
            <div>
              <div className="text-[7px] sm:text-[9px] text-zinc-400 uppercase font-mono leading-none">TIME</div>
              <div className="font-teko text-base sm:text-xl font-bold text-white leading-none mt-0.5">{timeFormatted}</div>
            </div>
          </div>

          {/* Credits Awarded Strip */}
          <div className="col-span-2 sm:col-span-4 flex items-center justify-between bg-emerald-950/40 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-emerald-500/50 mt-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-emerald-900/80 border border-emerald-400/60 flex items-center justify-center shrink-0">
                <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-300" />
              </div>
              <div>
                <div className="text-[7px] sm:text-[9px] text-emerald-300 uppercase font-mono leading-none">CREDITS REWARD</div>
                <div className="font-teko text-lg sm:text-2xl font-black text-emerald-400 leading-none mt-0.5">
                  +${stats.creditsEarned.toLocaleString()}
                </div>
              </div>
            </div>
            {isVictory && (
              <span className="font-teko text-[10px] sm:text-sm bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 sm:px-2 py-0.5 rounded uppercase font-bold">
                COMPLETED
              </span>
            )}
          </div>
        </div>

        {/* Tactile Action Buttons - Mobile Ergonomic Design */}
        <div className="flex flex-col gap-1.5 sm:gap-2">
          {/* Primary Action Button (Next Mission if victory, Replay if defeat) */}
          {isVictory && onNextMission ? (
            <button
              onClick={onNextMission}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-teko text-xl sm:text-2xl md:text-3xl font-black py-2 sm:py-3 px-4 rounded-xl shadow-xl shadow-emerald-950/80 active:scale-[0.98] transition-all cursor-pointer border border-emerald-400/50 min-h-[48px] short:min-h-[40px] touch-manipulation"
            >
              <span>NEXT MISSION</span>
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          ) : (
            <button
              onClick={onRetry}
              className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-teko text-xl sm:text-2xl md:text-3xl font-black py-2 sm:py-3 px-4 rounded-xl shadow-xl shadow-red-950/80 active:scale-[0.98] transition-all cursor-pointer border border-red-400/50 min-h-[48px] short:min-h-[40px] touch-manipulation"
            >
              <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
              <span>{isVictory ? 'REPLAY MISSION' : 'RETRY MISSION'}</span>
            </button>
          )}

          {/* Secondary Actions Row */}
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            {isVictory && onNextMission && (
              <button
                onClick={onRetry}
                className="flex items-center justify-center gap-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-teko text-base sm:text-xl font-bold py-1.5 sm:py-2.5 rounded-lg border border-zinc-700 active:scale-[0.98] transition-all cursor-pointer min-h-[44px] touch-manipulation"
              >
                <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                <span>REPLAY</span>
              </button>
            )}

            <button
              onClick={onOpenArsenal}
              className={`flex items-center justify-center gap-1 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-black font-teko text-base sm:text-xl font-black py-1.5 sm:py-2.5 rounded-lg shadow-md active:scale-[0.98] transition-all cursor-pointer border border-amber-400/60 min-h-[44px] touch-manipulation ${
                !isVictory || !onNextMission ? 'col-span-2' : ''
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-black" />
              <span>UPGRADE ARSENAL</span>
            </button>
          </div>

          {/* Main Menu Button */}
          <button
            onClick={onMainMenu}
            className="flex items-center justify-center gap-1.5 text-zinc-400 hover:text-white font-teko text-sm sm:text-lg font-bold py-1 transition-colors cursor-pointer active:scale-95 min-h-[36px] touch-manipulation"
          >
            <Home className="w-3.5 h-3.5" />
            <span>RETURN TO MAIN MENU</span>
          </button>
        </div>
      </div>
    </div>
  );
};
