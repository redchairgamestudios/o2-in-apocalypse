/**
 * Adaptive Performance: watches sustained frame times and, only when the
 * user opted in, trades render scale (then non-essential effects) for FPS.
 *
 * Design constraints:
 * - Reacts to *persistent* degradation (3 consecutive bad seconds), never a
 *   single hitch.
 * - Recovers cautiously (5 consecutive good seconds, one step at a time).
 * - Hysteresis + cooldown prevent up/down oscillation.
 * - Never touches the user's saved config — adjustments are session-local
 *   overlays and reset on menu/mount.
 * - Cannot overcome hardware limits; it only re-spends the budget.
 */
import { GraphicsSettings } from './GraphicsSettings';

interface Thresholds {
  /** Below this FPS the mode counts a "bad second" (relative to the target). */
  degradeFps: number;
  /** Above this FPS the mode counts a "good second". */
  recoverFps: number;
  badSecondsToDegrade: number;
  goodSecondsToRecover: number;
  /** Seconds after an adjustment before another may occur. */
  cooldownSeconds: number;
}

export interface AdaptiveState {
  /** Current dynamic multiplier applied on top of the configured renderScale. */
  dynamicScale: number;
  /** True while the initial warm-up window (shader compile / level load) runs. */
  warming: boolean;
}

const MIN_DYNAMIC = 0.7; // dynamic overlay never pushes effective scale below 70% of configured
const STEP_DOWN = 0.1;
const STEP_UP = 0.1;

export class AdaptivePerformance {
  private dynamicScale = 1.0;
  private badSeconds = 0;
  private goodSeconds = 0;
  private warmupSeconds = 0;
  private cooldown = 0;
  private playingSeconds = 0;
  private fpsCap = 60;

  /** Effective render scale after the dynamic overlay (config × dynamic). */
  public effectiveScale(baseRenderScale: number): number {
    return Math.max(0.3, baseRenderScale * this.dynamicScale);
  }

  public get state(): AdaptiveState {
    return { dynamicScale: this.dynamicScale, warming: this.warmupSeconds < 4 };
  }

  /** Called when the user changes the FPS target (thresholds follow it). */
  public setFpsCap(target: number) {
    this.fpsCap = target;
  }

  public reset() {
    this.dynamicScale = 1.0;
    this.badSeconds = 0;
    this.goodSeconds = 0;
    this.warmupSeconds = 0;
    this.playingSeconds = 0;
    this.cooldown = 0;
  }

  private thresholds(): Thresholds {
    // Degrade when we hold less than ~85% of the target; recover once we
    // comfortably exceed it.
    const t = this.fpsCap;
    return {
      degradeFps: Math.max(20, t * 0.85),
      recoverFps: Math.min(t + 4, t * 1.15),
      badSecondsToDegrade: 3,
      goodSecondsToRecover: 5,
      cooldownSeconds: 4,
    };
  }

  /**
   * Feed one 1-second FPS sample. Returns a message when an adjustment was
   * made this second (for the HUD toast), otherwise null.
   */
  public sample(measuredFps: number, isPlaying: boolean): string | null {
    if (!GraphicsSettings.get().adaptivePerformance) {
      // Disabled: keep state clean so re-enabling starts fresh at full scale.
      if (this.dynamicScale !== 1.0) this.reset();
      return null;
    }

    if (!isPlaying) {
      // Menus/cutscenes: restore full scale so it never sticks low.
      if (this.dynamicScale !== 1.0 || this.badSeconds || this.goodSeconds) this.reset();
      return null;
    }

    this.playingSeconds++;
    this.warmupSeconds++;
    if (this.cooldown > 0) this.cooldown--;

    // Ignore the first seconds of a session (level load, shader compile).
    if (this.playingSeconds <= 4) return null;

    const th = this.thresholds();

    if (measuredFps < th.degradeFps) {
      this.badSeconds++;
      this.goodSeconds = 0;
      if (this.badSeconds >= th.badSecondsToDegrade && this.cooldown <= 0 && this.dynamicScale > MIN_DYNAMIC) {
        this.dynamicScale = Math.max(MIN_DYNAMIC, this.dynamicScale - STEP_DOWN);
        this.badSeconds = 0;
        this.cooldown = th.cooldownSeconds;
        const pct = Math.round(this.dynamicScale * 100);
        return `Adaptive: performance low — render scale reduced to ${pct}%`;
      }
    } else if (measuredFps >= th.recoverFps) {
      this.goodSeconds++;
      this.badSeconds = 0;
      if (this.goodSeconds >= th.goodSecondsToRecover && this.cooldown <= 0 && this.dynamicScale < 1.0) {
        this.dynamicScale = Math.min(1.0, this.dynamicScale + STEP_UP);
        this.goodSeconds = 0;
        this.cooldown = th.cooldownSeconds;
        const pct = Math.round(this.dynamicScale * 100);
        return `Adaptive: performance recovered — render scale raised to ${pct}%`;
      }
    } else {
      // Hysteresis band: decay both counters so a flapping frame rate
      // around the threshold can never oscillate the setting.
      this.badSeconds = Math.max(0, this.badSeconds - 1);
      this.goodSeconds = Math.max(0, this.goodSeconds - 1);
    }
    return null;
  }
}
