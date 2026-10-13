import React, { useState, useEffect } from 'react';
import { GameSettings } from '../types';
import { SaveManager } from '../core/SaveManager';
import { soundFx } from '../audio/SoundEffects';
import { Settings as SettingsIcon, X, Volume2, Smartphone, Monitor, RotateCcw, Gauge, Target, Zap, Image, SlidersHorizontal, RefreshCw, Check } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { GraphicsSettings, type GraphicsConfig, type GraphicsPreset, type FpsTarget, availableFpsTargets, probeRefreshRate } from '../core/GraphicsSettings';

interface SettingsModalProps {
  settings: GameSettings;
  onClose: () => void;
  onSettingsChanged: () => void;
}

const PRESET_LABELS: Record<GraphicsPreset, { title: string; desc: string }> = {
  SMOOTH: { title: 'SMOOTH (60%)', desc: 'Best FPS — shadows off, bloom off, low particles, near view' },
  BALANCED: { title: 'BALANCED (75%)', desc: 'Good FPS — medium effects, balanced detail, medium view' },
  ULTRA: { title: 'ULTRA (100%)', desc: 'Best visuals — shadows on, bloom on, full particles, far view' },
};

const FX_LEVEL_LABELS: Record<string, string> = {
  OFF: 'OFF (Fastest)',
  LOW: 'LOW (Grade only)',
  MEDIUM: 'MEDIUM (Bloom)',
  HIGH: 'HIGH (Bloom + Grade)',
};

const VIEW_DIST_LABELS: Record<string, string> = {
  NEAR: 'NEAR (150m)',
  MEDIUM: 'MEDIUM (200m)',
  FAR: 'FAR (250m)',
  ULTRA: 'ULTRA (300m)',
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onClose,
  onSettingsChanged,
}) => {
  const [graphicsConfig, setGraphicsConfig] = useState<GraphicsConfig>(GraphicsSettings.get());
  const [activeTab, setActiveTab] = useState<'audio' | 'controls' | 'graphics' | 'performance'>('graphics');
  const [refreshRate, setRefreshRate] = useState<number>(0);
  const [toast, setToast] = useState<string | null>(null);

  // Probe refresh rate once
  useEffect(() => {
    probeRefreshRate((hz) => setRefreshRate(hz));
  }, []);

  // Listen for adaptive performance toasts
  useEffect(() => {
    const handleToast = (e: CustomEvent) => {
      setToast(e.detail.message);
      setTimeout(() => setToast(null), 3000);
    };
    window.addEventListener('adaptive-performance', handleToast as EventListener);
    return () => window.removeEventListener('adaptive-performance', handleToast as EventListener);
  }, []);

  const updateGameSettings = (partial: Partial<GameSettings>) => {
    SaveManager.updateSettings(partial);
    soundFx.updateVolumes(
      partial.masterVolume ?? settings.masterVolume,
      partial.sfxVolume ?? settings.sfxVolume,
      partial.musicVolume ?? settings.musicVolume
    );
    onSettingsChanged();
  };

  const updateGraphics = (partial: Partial<GraphicsConfig>) => {
    GraphicsSettings.patch(partial);
    setGraphicsConfig(GraphicsSettings.get());
    onSettingsChanged();
  };

  const applyPreset = (preset: GraphicsPreset) => {
    GraphicsSettings.applyPreset(preset);
    setGraphicsConfig(GraphicsSettings.get());
    onSettingsChanged();
  };

  const handleResetGraphics = () => {
    GraphicsSettings.resetToDefaults();
    setGraphicsConfig(GraphicsSettings.get());
    onSettingsChanged();
  };

  const handleResetProgress = () => {
    if (confirm('Reset all mission progress and weapons to factory default?')) {
      SaveManager.resetProgress();
      onSettingsChanged();
      onClose();
    }
  };

  const renderTabButton = (id: 'audio' | 'controls' | 'graphics' | 'performance', label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded font-teko text-base font-bold transition-all border ${
        activeTab === id
          ? 'bg-red-600 border-red-500 text-white shadow'
          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

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

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 mb-6">
        {renderTabButton('audio', 'AUDIO', <Volume2 className="w-4 h-4" />)}
        {renderTabButton('controls', 'CONTROLS', <Smartphone className="w-4 h-4" />)}
        {renderTabButton('graphics', 'GRAPHICS', <Image className="w-4 h-4" />)}
        {renderTabButton('performance', 'PERFORMANCE', <Gauge className="w-4 h-4" />)}
      </div>

      {toast && (
        <div className="mb-4 p-3 bg-amber-900/50 border border-amber-700 rounded-lg text-amber-200 text-xs font-military animate-pulse">
          {toast}
        </div>
      )}

      <div className="max-w-3xl mx-auto w-full space-y-6 mt-6">
        {/* Audio Tab */}
        {activeTab === 'audio' && (
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
                onChange={(e) => updateGameSettings({ masterVolume: parseFloat(e.target.value) })}
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
                onChange={(e) => updateGameSettings({ sfxVolume: parseFloat(e.target.value) })}
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
                onChange={(e) => updateGameSettings({ musicVolume: parseFloat(e.target.value) })}
                className="w-full accent-red-600"
              />
            </div>
          </div>
        )}

        {/* Controls Tab */}
        {activeTab === 'controls' && (
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
                onChange={(e) => updateGameSettings({ mouseSensitivity: parseFloat(e.target.value) })}
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
                onChange={(e) => updateGameSettings({ touchSensitivity: parseFloat(e.target.value) })}
                className="w-full accent-blue-600"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-military text-zinc-300">TACTICAL AIM ASSISTANCE</span>
              <button
                onClick={() => updateGameSettings({ aimAssist: !settings.aimAssist })}
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
                onClick={() => updateGameSettings({ invertY: !settings.invertY })}
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
                onClick={() => updateGameSettings({ invertX: !settings.invertX })}
                className={`px-3 py-1 rounded font-teko text-base font-bold ${
                  settings.invertX ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {settings.invertX ? 'INVERTED' : 'NORMAL'}
              </button>
            </div>
          </div>
        )}

        {/* Graphics Tab */}
        {activeTab === 'graphics' && (
          <>
            {/* Preset Cards */}
            <div className="bg-zinc-900/80 p-5 rounded-lg border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-teko text-xl text-zinc-200">
                  <Image className="w-5 h-5 text-cyan-500" />
                  <span>GRAPHICS PRESET</span>
                </div>
                <button
                  onClick={handleResetGraphics}
                  className="px-3 py-1.5 rounded font-teko text-sm font-bold bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>RESET</span>
                </button>
              </div>
              <div className="text-xs font-military text-zinc-500">
                Presets apply a full configuration in one tap. Customize individual settings below.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(['SMOOTH', 'BALANCED', 'ULTRA'] as GraphicsPreset[]).map((preset) => {
                  const config = PRESET_LABELS[preset];
                  const isActive = graphicsConfig.preset === preset;
                  return (
                    <button
                      key={preset}
                      onClick={() => applyPreset(preset)}
                      className={`relative p-4 rounded-lg border-2 transition-all text-left ${
                        isActive
                          ? 'bg-red-950/60 border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                          : 'bg-zinc-800/80 border-zinc-700 hover:border-zinc-600'
                      }`}
                    >
                      {isActive && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 text-red-400">
                          <Check className="w-4 h-4" />
                          <span className="text-xs font-teko">ACTIVE</span>
                        </div>
                      )}
                      <div className="font-teko text-lg text-white">{config.title}</div>
                      <div className="text-xs font-military text-zinc-400 mt-1">{config.desc}</div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-[10px] font-military text-zinc-500">
                          {Math.round(graphicsConfig.renderScale * 100)}% render
                        </span>
                        <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-[10px] font-military text-zinc-500">
                          {graphicsConfig.shadows ? 'Shadows ON' : 'Shadows OFF'}
                        </span>
                        <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-[10px] font-military text-zinc-500">
                          {FX_LEVEL_LABELS[graphicsConfig.postProcessing]}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Individual Settings */}
            <div className="bg-zinc-900/80 p-5 rounded-lg border border-zinc-800 space-y-5">
              <div className="flex items-center gap-2 font-teko text-xl text-zinc-200">
                <SlidersHorizontal className="w-5 h-5 text-blue-500" />
                <span>CUSTOM SETTINGS</span>
              </div>
              <div className="text-xs font-military text-zinc-500">
                Fine-tune individual parameters. Changes apply live.
              </div>

              {/* Render Scale */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-military text-zinc-400">
                  <span>RENDER RESOLUTION SCALE</span>
                  <span>{Math.round(graphicsConfig.renderScale * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.4"
                  max="1.0"
                  step="0.05"
                  value={graphicsConfig.renderScale}
                  onChange={(e) => updateGraphics({ renderScale: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-600"
                />
                <div className="text-[11px] font-military text-zinc-500">
                  Internal framebuffer resolution multiplier. Lower = faster, blurrier.
                </div>
              </div>

              {/* Shadows Toggle */}
              <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
                <div>
                  <div className="text-xs font-military text-zinc-300">DYNAMIC SHADOWS</div>
                  <div className="text-[11px] font-military text-zinc-500">Sun/moon shadow maps (costly on mobile)</div>
                </div>
                <button
                  onClick={() => updateGraphics({ shadows: !graphicsConfig.shadows })}
                  className={`px-3 py-1 rounded font-teko text-base font-bold ${
                    graphicsConfig.shadows ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {graphicsConfig.shadows ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              {/* Effects Quality */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-military text-zinc-400">
                  <span>EFFECTS QUALITY</span>
                  <span>{graphicsConfig.effectsQuality}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['LOW', 'MEDIUM', 'HIGH', 'ULTRA'] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => updateGraphics({ effectsQuality: q })}
                      className={`px-3 py-1 rounded font-teko text-sm font-bold border transition-all ${
                        graphicsConfig.effectsQuality === q
                          ? 'bg-red-600 border-red-500 text-white shadow'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] font-military text-zinc-500">
                  Particle density, decal count, weather intensity, zombie/ally caps.
                </div>
              </div>

              {/* Texture Quality */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-military text-zinc-400">
                  <span>TEXTURE QUALITY</span>
                  <span>{graphicsConfig.textureQuality}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['LOW', 'MEDIUM', 'HIGH'] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => updateGraphics({ textureQuality: q })}
                      className={`px-3 py-1 rounded font-teko text-sm font-bold border transition-all ${
                        graphicsConfig.textureQuality === q
                          ? 'bg-red-600 border-red-500 text-white shadow'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] font-military text-zinc-500">
                  Procedural texture resolution (512² default, 256² on LOW).
                </div>
              </div>

              {/* Environment Detail */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-military text-zinc-400">
                  <span>ENVIRONMENT DETAIL</span>
                  <span>{graphicsConfig.environmentDetail}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['LOW', 'MEDIUM', 'HIGH', 'ULTRA'] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => updateGraphics({ environmentDetail: q })}
                      className={`px-3 py-1 rounded font-teko text-sm font-bold border transition-all ${
                        graphicsConfig.environmentDetail === q
                          ? 'bg-red-600 border-red-500 text-white shadow'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] font-military text-zinc-500">
                  Prop density, debris, foliage, decal persistence.
                </div>
              </div>

              {/* Post Processing */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-military text-zinc-400">
                  <span>POST PROCESSING</span>
                  <span>{FX_LEVEL_LABELS[graphicsConfig.postProcessing]}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['OFF', 'LOW', 'MEDIUM', 'HIGH'] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => updateGraphics({ postProcessing: q as any })}
                      className={`px-3 py-1 rounded font-teko text-sm font-bold border transition-all ${
                        graphicsConfig.postProcessing === q
                          ? 'bg-red-600 border-red-500 text-white shadow'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] font-military text-zinc-500">
                  OFF: direct render. LOW: color grade only. MEDIUM/HIGH: bloom + grade.
                </div>
              </div>

              {/* View Distance */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-military text-zinc-400">
                  <span>VIEW DISTANCE</span>
                  <span>{VIEW_DIST_LABELS[graphicsConfig.viewDistance]}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['NEAR', 'MEDIUM', 'FAR', 'ULTRA'] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => updateGraphics({ viewDistance: q as any })}
                      className={`px-3 py-1 rounded font-teko text-sm font-bold border transition-all ${
                        graphicsConfig.viewDistance === q
                          ? 'bg-red-600 border-red-500 text-white shadow'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] font-military text-zinc-500">
                  Camera far plane & fog distance. NEAR=150m, ULTRA=300m.
                </div>
              </div>

              {/* FPS Target */}
              <div className="space-y-2 border-t border-zinc-800 pt-3">
                <div className="flex justify-between text-xs font-military text-zinc-400">
                  <span>TARGET FPS</span>
                  <span>{graphicsConfig.fpsTarget} FPS</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableFpsTargets().map((fps) => (
                    <button
                      key={fps}
                      onClick={() => updateGraphics({ fpsTarget: fps })}
                      className={`px-3 py-1 rounded font-teko text-sm font-bold border transition-all ${
                        graphicsConfig.fpsTarget === fps
                          ? 'bg-red-600 border-red-500 text-white shadow'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {fps} FPS
                    </button>
                  ))}
                </div>
                <div className="text-[11px] font-military text-zinc-500">
                  {refreshRate > 0
                    ? `Display: ${refreshRate}Hz — targets above panel rate use frame pacing.`
                    : 'Detecting display refresh rate…'}
                  90/120 FPS targets hidden: thermal/pipeline limits make them dishonest.
                </div>
              </div>

              {/* Adaptive Performance */}
              <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
                <div>
                  <div className="text-xs font-military text-zinc-300">ADAPTIVE PERFORMANCE</div>
                  <div className="text-[11px] font-military text-zinc-500">
                    Auto-lowers render scale when FPS drops below target. Recovers when stable.
                  </div>
                </div>
                <button
                  onClick={() => updateGraphics({ adaptivePerformance: !graphicsConfig.adaptivePerformance })}
                  className={`px-3 py-1 rounded font-teko text-base font-bold ${
                    graphicsConfig.adaptivePerformance ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {graphicsConfig.adaptivePerformance ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && (
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
                onClick={() => updateGameSettings({ showFps: !settings.showFps })}
                className={`px-3 py-1 rounded font-teko text-base font-bold ${
                  settings.showFps ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-500'
                }`}
              >
                {settings.showFps ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
              <div>
                <div className="text-xs font-military text-zinc-300">PERFORMANCE MONITOR</div>
                <div className="text-[11px] font-military text-zinc-500">Detailed stats: draw calls, triangles, particles, memory [F4]</div>
              </div>
              <button
                onClick={() => updateGameSettings({ showPerformancePanel: !settings.showPerformancePanel })}
                className={`px-3 py-1 rounded font-teko text-base font-bold ${
                  settings.showPerformancePanel ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-500'
                }`}
              >
                {settings.showPerformancePanel ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
              <div>
                <div className="text-xs font-military text-zinc-300">DEVICE CAPABILITIES</div>
                <div className="text-[11px] font-military text-zinc-500">Shows detected hardware tier and capabilities</div>
              </div>
              <button
                onClick={() => alert(`Device: ${JSON.stringify({
                  isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
                  memoryGb: (navigator as any).deviceMemory ?? 'unknown',
                  cores: navigator.hardwareConcurrency ?? 'unknown',
                  refreshHz: refreshRate || 'detecting…',
                  dpr: window.devicePixelRatio,
                }, null, 2)}`)}
                className="px-3 py-1 rounded font-teko text-base font-bold bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600"
              >
                VIEW
              </button>
            </div>
          </div>
        )}

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
            onClick={handleResetProgress}
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