import React from 'react';
import { GameSettings } from '../types';
import { SaveManager } from '../core/SaveManager';
import { soundFx } from '../audio/SoundEffects';
import { Settings as SettingsIcon, X, Volume2, Smartphone, Monitor, RotateCcw, Gauge } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsModalProps {
  settings: GameSettings;
  onClose: () => void;
  onSettingsChanged: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onClose,
  onSettingsChanged,
}) => {
  const update = (partial: Partial<GameSettings>) => {
    SaveManager.updateSettings(partial);
    soundFx.updateVolumes(
      partial.masterVolume ?? settings.masterVolume,
      partial.sfxVolume ?? settings.sfxVolume,
      partial.musicVolume ?? settings.musicVolume
    );
    onSettingsChanged();
  };

  const handleReset = () => {
    if (confirm('Reset all mission progress and weapons to factory default?')) {
      SaveManager.resetProgress();
      onSettingsChanged();
      onClose();
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col p-4 md:p-8 pointer-events-auto overflow-y-auto select-none touch-manipulation">
      <div className="flex justify-between items-center pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <SettingsIcon className="w-6 h-6 text-zinc-400" />
          <h2 className="font-teko text-3xl md:text-4xl font-bold tracking-wide text-white">
            OPERATIONAL SETTINGS
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="max-w-2xl mx-auto w-full space-y-6 mt-6">
        {/* Audio settings */}
        <div className="bg-zinc-900/80 p-5 rounded-lg border border-zinc-800 space-y-4">
          <div className="flex items-center gap-2 font-teko text-xl text-zinc-200">
            <Volume2 className="w-5 h-5 text-amber-500" />
            <span>AUDIO LEVELS</span>
          </div>

          <div>
            <div className="flex justify-between text-xs font-military text-zinc-400 mb-1">
              <span>MASTER VOLUME</span>
              <span>{Math.round(settings.masterVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.masterVolume}
              onChange={(e) => update({ masterVolume: parseFloat(e.target.value) })}
              className="w-full accent-red-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-military text-zinc-400 mb-1">
              <span>EFFECTS (GUNFIRE / ROARS)</span>
              <span>{Math.round(settings.sfxVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.sfxVolume}
              onChange={(e) => update({ sfxVolume: parseFloat(e.target.value) })}
              className="w-full accent-red-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-military text-zinc-400 mb-1">
              <span>DARK AMBIENT TENSION DRONE</span>
              <span>{Math.round(settings.musicVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.musicVolume}
              onChange={(e) => update({ musicVolume: parseFloat(e.target.value) })}
              className="w-full accent-red-600"
            />
          </div>
        </div>

        {/* Controls & Sensitivity */}
        <div className="bg-zinc-900/80 p-5 rounded-lg border border-zinc-800 space-y-4">
          <div className="flex items-center gap-2 font-teko text-xl text-zinc-200">
            <Smartphone className="w-5 h-5 text-blue-500" />
            <span>AIM SENSITIVITY & CONTROLS</span>
          </div>

          <div>
            <div className="flex justify-between text-xs font-military text-zinc-400 mb-1">
              <span>MOUSE LOOK SENSITIVITY (DESKTOP)</span>
              <span>{settings.mouseSensitivity.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="2.5"
              step="0.1"
              value={settings.mouseSensitivity}
              onChange={(e) => update({ mouseSensitivity: parseFloat(e.target.value) })}
              className="w-full accent-blue-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-military text-zinc-400 mb-1">
              <span>TOUCH LOOK SENSITIVITY (MOBILE)</span>
              <span>{settings.touchSensitivity.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.4"
              max="3.0"
              step="0.1"
              value={settings.touchSensitivity}
              onChange={(e) => update({ touchSensitivity: parseFloat(e.target.value) })}
              className="w-full accent-blue-600"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-military text-zinc-300">TACTICAL AIM ASSISTANCE</span>
            <button
              onClick={() => update({ aimAssist: !settings.aimAssist })}
              className={`px-3 py-1 rounded font-teko text-base font-bold ${
                settings.aimAssist ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              {settings.aimAssist ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
            <div>
              <div className="text-xs font-military text-zinc-300">INVERT Y-AXIS (VERTICAL LOOK)</div>
              <div className="text-[11px] font-military text-zinc-500">Normal: Push mouse forward to look UP</div>
            </div>
            <button
              onClick={() => update({ invertY: !settings.invertY })}
              className={`px-3 py-1 rounded font-teko text-base font-bold ${
                settings.invertY ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {settings.invertY ? 'INVERTED (FLIGHT)' : 'NORMAL'}
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
            <div>
              <div className="text-xs font-military text-zinc-300">INVERT X-AXIS (HORIZONTAL LOOK)</div>
              <div className="text-[11px] font-military text-zinc-500">Normal: Move mouse right to look RIGHT</div>
            </div>
            <button
              onClick={() => update({ invertX: !settings.invertX })}
              className={`px-3 py-1 rounded font-teko text-base font-bold ${
                settings.invertX ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {settings.invertX ? 'INVERTED' : 'NORMAL'}
            </button>
          </div>
        </div>

        {/* Graphics Quality */}
        <div className="bg-zinc-900/80 p-5 rounded-lg border border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-teko text-xl text-zinc-200">RENDER GRAPHICS QUALITY</div>
            <div className="text-xs font-military text-zinc-500">Optimizes dynamic shadows and particle density</div>
          </div>

          <div className="flex gap-2">
            {(['LOW', 'MEDIUM', 'HIGH'] as const).map((q) => (
              <button
                key={q}
                onClick={() => update({ graphicsQuality: q })}
                className={`px-3 py-1 rounded font-teko text-base font-bold border transition-all ${
                  settings.graphicsQuality === q
                    ? 'bg-red-600 border-red-500 text-white shadow'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Performance & Debug */}
        <div className="bg-zinc-900/80 p-5 rounded-lg border border-zinc-800 space-y-4">
          <div className="flex items-center gap-2 font-teko text-xl text-zinc-200">
            <Gauge className="w-5 h-5 text-cyan-500" />
            <span>PERFORMANCE & DEBUG</span>
          </div>

          <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
            <div>
              <div className="text-xs font-military text-zinc-300">SHOW FPS COUNTER</div>
              <div className="text-[11px] font-military text-zinc-500">Displays real-time frame rate in top-left corner</div>
            </div>
            <button
              onClick={() => update({ showFps: !settings.showFps })}
              className={`px-3 py-1 rounded font-teko text-base font-bold ${
                settings.showFps ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              {settings.showFps ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>
        </div>

        {/* PWA App Installation */}
        <div className="bg-zinc-900/80 p-4 rounded-lg border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/app-logo.png"
              alt="O² in Apocalypse"
              className="w-12 h-12 object-contain rounded-lg border border-zinc-700 bg-black/90 p-1 shadow"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="font-teko text-xl text-zinc-100 font-bold tracking-wide">
                O² IN APOCALYPSE (PWA)
              </div>
              <div className="text-xs font-military text-zinc-400">
                Install as standalone app for offline play and full-screen FPS immersion
              </div>
            </div>
          </div>

          <PWAInstallButton />
        </div>

        {/* Reset Progress */}
        <div className="pt-4 flex flex-wrap justify-between items-center gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 text-xs font-military text-red-500 hover:text-red-400 bg-red-950/40 hover:bg-red-950/70 border border-red-800/80 px-4 py-2 rounded transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET ALL MISSION PROGRESS & ARSENAL</span>
          </button>

          <button
            onClick={onClose}
            className="bg-zinc-800 hover:bg-zinc-700 text-white font-teko text-xl font-bold px-6 py-2 rounded border border-zinc-600"
          >
            SAVE & CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
