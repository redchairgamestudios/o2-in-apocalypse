/**
 * Centralized graphics configuration — the single source of truth every
 * rendering / effects / AI system reads. Versioned, validated, persisted to
 * localStorage independently of the gameplay save so changing graphics can
 * never corrupt mission progress.
 */

export type GraphicsPreset = 'SMOOTH' | 'BALANCED' | 'ULTRA';
export type EffectsQuality = 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';
export type TextureQuality = 'LOW' | 'MEDIUM' | 'HIGH';
export type EnvDetail = 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';
export type PostFXLevel = 'OFF' | 'LOW' | 'MEDIUM' | 'HIGH';
export type ViewDistance = 'NEAR' | 'MEDIUM' | 'FAR' | 'ULTRA';
export type FpsTarget = 30 | 40 | 60;

export interface GraphicsConfig {
  preset: GraphicsPreset;
  renderScale: number;      // 0.4 .. 1.0 — multiplies devicePixelRatio
  fpsTarget: FpsTarget;
  shadows: boolean;
  effectsQuality: EffectsQuality;
  textureQuality: TextureQuality;
  environmentDetail: EnvDetail;
  postProcessing: PostFXLevel;
  viewDistance: ViewDistance;
  adaptivePerformance: boolean;
}

export const GRAPHICS_STORAGE_KEY = 'deadzone_graphics_v1';
const GRAPHICS_VERSION = 1;

/** Preset starting configurations. Values are tunable baselines, not guarantees. */
export const PRESET_DEFAULTS: Record<GraphicsPreset, Omit<GraphicsConfig, 'preset' | 'fpsTarget' | 'adaptivePerformance'>> = {
  SMOOTH: {
    renderScale: 0.6,
    shadows: false,
    effectsQuality: 'LOW',
    textureQuality: 'LOW',
    environmentDetail: 'LOW',
    postProcessing: 'OFF',
    viewDistance: 'NEAR',
  },
  BALANCED: {
    renderScale: 0.75,
    shadows: false,
    effectsQuality: 'MEDIUM',
    textureQuality: 'MEDIUM',
    environmentDetail: 'MEDIUM',
    postProcessing: 'OFF',
    viewDistance: 'MEDIUM',
  },
  ULTRA: {
    renderScale: 1.0,
    shadows: true,
    effectsQuality: 'ULTRA',
    textureQuality: 'HIGH',
    environmentDetail: 'ULTRA',
    postProcessing: 'MEDIUM',
    viewDistance: 'FAR',
  },
};

const RENDER_SCALE_MIN = 0.4;
const RENDER_SCALE_MAX = 1.0;

// ---------------------------------------------------------------------------
// Device capability probing
// ---------------------------------------------------------------------------

export interface DeviceCapabilities {
  isTouch: boolean;
  memoryGb: number;
  cores: number;
  /** Estimated display refresh rate (Hz); 0 = unknown. */
  refreshHz: number;
}

let cachedCaps: DeviceCapabilities | null = null;

/** One-time rAF sampling of display refresh rate (best effort, ~0.5s). */
export function measureRefreshRate(): Promise<number> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function') {
      resolve(0);
      return;
    }
    const samples: number[] = [];
    let last = performance.now();
    let count = 0;
    const tick = (t: number) => {
      samples.push(t - last);
      last = t;
      count++;
      if (count >= 30) {
        samples.sort((a, b) => a - b);
        const median = samples[Math.floor(samples.length / 2)];
        const hz = median > 0 ? Math.round(1000 / median) : 0;
        resolve(Math.min(hz, 240));
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // Safety: never hang the settings UI on a probe
    setTimeout(() => resolve(0), 2000);
  });
}

export function getDeviceCapabilities(): DeviceCapabilities {
  if (cachedCaps) return cachedCaps;
  const nav = navigator as Navigator & { deviceMemory?: number };
  cachedCaps = {
    isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    memoryGb: nav.deviceMemory ?? 0,
    cores: navigator.hardwareConcurrency ?? 0,
    refreshHz: 0,
  };
  return cachedCaps;
}

/** Kick off the refresh probe once; the FPS selector re-renders when it lands. */
export function probeRefreshRate(onDone?: (hz: number) => void): void {
  const caps = getDeviceCapabilities();
  if (caps.refreshHz > 0) {
    onDone?.(caps.refreshHz);
    return;
  }
  measureRefreshRate().then((hz) => {
    if (hz > 0) {
      caps.refreshHz = hz;
      onDone?.(hz);
    }
  });
}

/**
 * FPS targets exposed to the user. 90/120 are never advertised — the render
 * pipeline cannot guarantee them and mid-range phone panels/thermal budgets
 * make the claim dishonest.
 */
export function availableFpsTargets(): FpsTarget[] {
  const caps = getDeviceCapabilities();
  const targets: FpsTarget[] = [30];
  // 40 requires a panel that can physically display more than 40 distinct
  // frames; a 60Hz display can approximate it with frame pacing (30/60 mix),
  // which is acceptable and honest. Above 60Hz everything is exposed.
  if (!caps.isTouch || caps.refreshHz === 0 || caps.refreshHz >= 55) targets.push(40);
  if (!caps.isTouch || caps.refreshHz >= 55) targets.push(60);
  return targets;
}

// ---------------------------------------------------------------------------
// Derived tuning tables (single definition — no duplicated magic numbers)
// ---------------------------------------------------------------------------

export function getEffectiveDprCap(isTouch: boolean): number {
  // Conservative fill-rate caps: mobile GPUs (Mali-G52 class) cannot hold 30
  // FPS near native DPR with a real 3D scene. Desktop keeps headroom.
  return isTouch ? 1.0 : 1.5;
}

export function getViewDistanceRange(vd: ViewDistance): { far: number; fogFar: number } {
  switch (vd) {
    case 'NEAR': return { far: 150, fogFar: 150 };
    case 'MEDIUM': return { far: 200, fogFar: 210 };
    case 'FAR': return { far: 250, fogFar: 260 };
    case 'ULTRA': return { far: 300, fogFar: 310 };
  }
}

export function getParticleScale(effects: EffectsQuality): number {
  switch (effects) {
    case 'LOW': return 0.45;
    case 'MEDIUM': return 0.7;
    case 'HIGH': return 1.0;
    case 'ULTRA': return 1.0;
  }
}

export function getZombieLimits(effects: EffectsQuality, isTouch: boolean): { maxAlive: number; maxCorpses: number } {
  if (isTouch) {
    switch (effects) {
      case 'LOW': return { maxAlive: 6, maxCorpses: 4 };
      case 'MEDIUM': return { maxAlive: 8, maxCorpses: 6 };
      case 'HIGH': return { maxAlive: 10, maxCorpses: 8 };
      case 'ULTRA': return { maxAlive: 12, maxCorpses: 10 };
    }
  }
  switch (effects) {
    case 'LOW': return { maxAlive: 14, maxCorpses: 14 };
    case 'MEDIUM': return { maxAlive: 18, maxCorpses: 18 };
    case 'HIGH': return { maxAlive: 24, maxCorpses: 22 };
    case 'ULTRA': return { maxAlive: 24, maxCorpses: 22 };
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type Listener = (config: GraphicsConfig) => void;

class GraphicsSettingsStore {
  private config: GraphicsConfig;
  private listeners = new Set<Listener>();
  private adaptiveListeners = new Set<(msg: string) => void>();

  constructor() {
    this.config = this.loadAndValidate();
  }

  public get(): GraphicsConfig {
    return this.config;
  }

  public subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  /** Notifications when Adaptive Performance auto-adjusts (for the HUD toast). */
  public onAdaptiveAdjust(fn: (msg: string) => void): () => void {
    this.adaptiveListeners.add(fn);
    return () => { this.adaptiveListeners.delete(fn); };
  }

  public notifyAdaptive(msg: string) {
    this.adaptiveListeners.forEach((fn) => fn(msg));
  }

  /** Replace the whole config (Apply button). Validates + persists + notifies. */
  public set(next: GraphicsConfig): void {
    this.config = this.validate(next);
    this.persist();
    this.listeners.forEach((fn) => fn(this.config));
  }

  /** Patch individual fields without leaving the current preset lineage. */
  public patch(partial: Partial<GraphicsConfig>): void {
    this.set({ ...this.config, ...partial });
  }

  public applyPreset(preset: GraphicsPreset): void {
    this.set({ ...this.config, preset, ...PRESET_DEFAULTS[preset] });
  }

  public resetToDefaults(): void {
    const caps = getDeviceCapabilities();
    const preset: GraphicsPreset = caps.isTouch ? 'SMOOTH' : 'BALANCED';
    this.set({
      preset,
      ...PRESET_DEFAULTS[preset],
      fpsTarget: defaultFpsTarget(caps),
      adaptivePerformance: caps.isTouch,
    });
  }

  private defaultFpsTarget(): FpsTarget {
    return defaultFpsTarget(getDeviceCapabilities());
  }

  // --- persistence ---------------------------------------------------------

  private persist(): void {
    try {
      const payload = { version: GRAPHICS_VERSION, config: this.config };
      localStorage.setItem(GRAPHICS_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('Failed to persist graphics settings:', e);
    }
  }

  private loadAndValidate(): GraphicsConfig {
    const caps = getDeviceCapabilities();
    const defaults = (): GraphicsConfig => {
      const preset: GraphicsPreset = caps.isTouch ? 'SMOOTH' : 'BALANCED';
      return {
        preset,
        ...PRESET_DEFAULTS[preset],
        fpsTarget: defaultFpsTarget(caps),
        adaptivePerformance: caps.isTouch,
      };
    };

    try {
      const raw = localStorage.getItem(GRAPHICS_STORAGE_KEY);
      if (!raw) {
        // First launch: migrate from the legacy graphicsQuality if present,
        // otherwise take device-aware defaults.
        return this.migrateLegacy(caps) ?? defaults();
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return defaults();
      if (parsed.version !== GRAPHICS_VERSION) return this.migrateLegacy(caps) ?? defaults();
      return this.validate({ ...defaults(), ...parsed.config });
    } catch {
      return defaults();
    }
  }

  /** Older saves stored quality inside the gameplay save; honor that choice. */
  private migrateLegacy(caps: DeviceCapabilities): GraphicsConfig | null {
    try {
      const rawSave = localStorage.getItem('deadzone_outbreak_save_v1');
      if (!rawSave) return null;
      const quality = JSON.parse(rawSave)?.settings?.graphicsQuality;
      if (!quality) return null;
      const preset: GraphicsPreset =
        quality === 'LOW' ? 'SMOOTH'
        : quality === 'HIGH' ? (caps.isTouch ? 'BALANCED' : 'ULTRA')
        : 'BALANCED';
      const config: GraphicsConfig = {
        preset,
        ...PRESET_DEFAULTS[preset],
        fpsTarget: defaultFpsTarget(caps),
        adaptivePerformance: caps.isTouch,
      };
      return this.validate(config);
    } catch {
      return null;
    }
  }

  private validate(cfg: GraphicsConfig): GraphicsConfig {
    const out: GraphicsConfig = { ...cfg };
    out.renderScale = Math.min(
      RENDER_SCALE_MAX,
      Math.max(RENDER_SCALE_MIN, Number(out.renderScale) || 0.6)
    );
    out.fpsTarget = ([30, 40, 60] as FpsTarget[]).includes(out.fpsTarget) ? out.fpsTarget : 30;
    out.shadows = Boolean(out.shadows);
    out.adaptivePerformance = Boolean(out.adaptivePerformance);
    if (!PRESET_DEFAULTS[out.preset]) out.preset = 'BALANCED';
    const effectsLevels: EffectsQuality[] = ['LOW', 'MEDIUM', 'HIGH', 'ULTRA'];
    if (!effectsLevels.includes(out.effectsQuality)) out.effectsQuality = 'MEDIUM';
    const texLevels: TextureQuality[] = ['LOW', 'MEDIUM', 'HIGH'];
    if (!texLevels.includes(out.textureQuality)) out.textureQuality = 'MEDIUM';
    const envLevels: EnvDetail[] = ['LOW', 'MEDIUM', 'HIGH', 'ULTRA'];
    if (!envLevels.includes(out.environmentDetail)) out.environmentDetail = 'MEDIUM';
    const fxLevels: PostFXLevel[] = ['OFF', 'LOW', 'MEDIUM', 'HIGH'];
    if (!fxLevels.includes(out.postProcessing)) out.postProcessing = 'OFF';
    const vdLevels: ViewDistance[] = ['NEAR', 'MEDIUM', 'FAR', 'ULTRA'];
    if (!vdLevels.includes(out.viewDistance)) out.viewDistance = 'MEDIUM';
    return out;
  }
}

function defaultFpsTarget(caps: DeviceCapabilities): FpsTarget {
  return caps.isTouch ? 30 : 60;
}

export const GraphicsSettings = new GraphicsSettingsStore();

/** Convenience for render-loop hot paths (no allocation). */
export function currentGraphics(): GraphicsConfig {
  return GraphicsSettings.get();
}
