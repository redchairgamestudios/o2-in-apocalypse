/**
 * First-run device tier detection: picks the default graphics quality from
 * hardware signals so low-end phones (e.g. 4GB RAM / Helio-class devices)
 * never start on a quality preset they cannot hold 30 FPS with. The player
 * can still override the tier in Settings — this only sets the default.
 */
import type { GameSettings } from '../types';

export type Quality = GameSettings['graphicsQuality'];

interface DeviceSignals {
  memoryGb: number; // navigator.deviceMemory (Chromium), 0 = unknown
  cores: number; // navigator.hardwareConcurrency, 0 = unknown
  isTouch: boolean;
  smallScreen: boolean;
}

export function detectDeviceSignals(): DeviceSignals {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    memoryGb: nav.deviceMemory ?? 0,
    cores: navigator.hardwareConcurrency ?? 0,
    isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    smallScreen: Math.min(window.innerWidth, window.innerHeight) <= 480,
  };
}

/**
 * LOW  — weak phones: ≤4GB RAM, or ≤4 cores, or small+touch with unknown RAM
 * MEDIUM — most touch devices (the safe default: Realme 7-class lands here
 *          only if it has ≥6GB reported; otherwise it gets LOW)
 * HIGH — desktops / strong tablets
 */
export function detectDefaultQuality(): Quality {
  const s = detectDeviceSignals();
  if (!s.isTouch) {
    return 'HIGH';
  }
  const weakRam = s.memoryGb > 0 && s.memoryGb <= 4;
  const weakCpu = s.cores > 0 && s.cores <= 4;
  const unknownButSmall = s.memoryGb === 0 && s.smallScreen;
  if (weakRam || weakCpu || unknownButSmall) {
    return 'LOW';
  }
  return s.memoryGb >= 8 || s.cores >= 8 ? 'HIGH' : 'MEDIUM';
}

/** One-line summary for the Settings modal / perf panel. */
export function describeDeviceTier(): string {
  const s = detectDeviceSignals();
  const ram = s.memoryGb > 0 ? `${s.memoryGb}GB RAM` : 'RAM ?';
  const cpu = s.cores > 0 ? `${s.cores} cores` : 'cores ?';
  return `${detectDefaultQuality()} tier · ${ram} · ${cpu}${s.isTouch ? ' · touch' : ''}`;
}
