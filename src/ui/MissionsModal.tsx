import React from 'react';
import { CAMPAIGN_MISSIONS } from '../data/missions';
import { PlayerSaveData } from '../types';
import { soundFx } from '../audio/SoundEffects';
import { Globe, Lock, CheckCircle2, ChevronRight, X, AlertTriangle } from 'lucide-react';

interface MissionsModalProps {
  saveData: PlayerSaveData;
  onSelectMission: (missionId: number) => void;
  onClose: () => void;
}

export const MissionsModal: React.FC<MissionsModalProps> = ({
  saveData,
  onSelectMission,
  onClose,
}) => {
  return (
    <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col p-4 md:p-8 short:p-3 pointer-events-auto overflow-y-auto select-none touch-manipulation">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-zinc-800 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Globe className="w-6 h-6 text-blue-500 shrink-0" />
          <h2 className="font-teko text-2xl sm:text-3xl md:text-4xl font-bold tracking-wide text-white truncate">
            QUARANTINE SECTOR CAMPAIGN MAP
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Mission Cards Grid */}
      <div className="grid grid-cols-1 min-[560px]:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-4 sm:mt-6">
        {CAMPAIGN_MISSIONS.map((m) => {
          const isUnlocked = m.id <= saveData.highestMissionUnlocked;
          const isCompleted = saveData.completedMissions.includes(m.id);

          return (
            <div
              key={m.id}
              className={`flex flex-col justify-between p-3 sm:p-5 short:p-3 rounded-lg border transition-all ${
                isUnlocked
                  ? 'bg-zinc-900/90 hover:bg-zinc-850 border-zinc-700 shadow-xl'
                  : 'bg-zinc-950/60 border-zinc-900 opacity-60'
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-xs text-red-500 font-bold uppercase tracking-wider">
                    {m.district}
                  </span>
                  {isCompleted ? (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-green-400 bg-green-950/60 px-2 py-0.5 rounded border border-green-800">
                      <CheckCircle2 className="w-3.5 h-3.5" /> SECURED
                    </span>
                  ) : !isUnlocked ? (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded">
                      <Lock className="w-3 h-3" /> LOCKED
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono text-yellow-400 bg-yellow-950/60 px-2 py-0.5 rounded border border-yellow-800">
                      ACTIVE
                    </span>
                  )}
                </div>

                <h3 className="font-teko text-xl sm:text-2xl font-bold text-white leading-snug">{m.title}</h3>
                <p className="font-military text-xs text-zinc-400 mt-2 line-clamp-2 sm:line-clamp-3">{m.briefing}</p>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-800/80 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono text-zinc-500 uppercase">MISSION REWARD</div>
                  <div className="font-teko text-lg font-bold text-amber-400">+${m.baseRewardCredits} CREDITS</div>
                </div>

                <button
                  disabled={!isUnlocked}
                  onClick={() => {
                    soundFx.playClick();
                    onSelectMission(m.id);
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded font-teko text-lg font-bold transition-all ${
                    isUnlocked
                      ? 'bg-red-600 hover:bg-red-500 text-white border border-red-400 active:scale-95 shadow-md'
                      : 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed'
                  }`}
                >
                  <span>{isCompleted ? 'REPLAY' : 'START'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
