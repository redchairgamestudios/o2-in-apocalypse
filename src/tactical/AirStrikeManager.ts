import * as THREE from 'three';
import { ZombieManager } from '../zombies/ZombieManager';
import { TurretManager } from './TurretManager';

export interface AirStrikeTarget {
  position: THREE.Vector3;
  radius: number;
  timestamp: number;
}

export class AirStrikeManager {
  private static scene: THREE.Scene | null = null;
  private static playerCamera: THREE.PerspectiveCamera | null = null;
  private static airstrikeCamera: THREE.PerspectiveCamera | null = null;
  private static isActive = false;
  private static targetPosition: THREE.Vector3 | null = null;
  private static charges = 4;
  private static maxCharges = 4;
  private static cooldownTimer = 0;
  private static readonly COOLDOWN = 15; // seconds between strikes
  private static readonly STRIKE_RADIUS = 15;
  private static readonly STRIKE_DAMAGE = 800;
  private static readonly TARGETING_HEIGHT = 80; // bird's-eye camera height
  private static readonly TARGETING_RANGE = 120; // max distance from player
  private static strikeEffect: THREE.Group | null = null;
  private static pendingStrike: AirStrikeTarget | null = null;
  private static onStrikeDamage: ((position: THREE.Vector3, radius: number, damage: number) => void) | null = null;
  private static enterGraceTimer = 0; // ignore shoot briefly after entering (same click shouldn't fire)

  static init(
    scene: THREE.Scene,
    playerCamera: THREE.PerspectiveCamera
  ): void {
    this.scene = scene;
    this.playerCamera = playerCamera;

    // Create bird's-eye camera
    this.airstrikeCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 500);
    this.airstrikeCamera.position.set(0, this.TARGETING_HEIGHT, 0);
    this.airstrikeCamera.lookAt(0, 0, 0);

    // Create strike visual effect group
    this.strikeEffect = new THREE.Group();
    this.strikeEffect.name = 'airstrike_effect';
    scene.add(this.strikeEffect);
  }

  static setStrikeDamageCallback(callback: (position: THREE.Vector3, radius: number, damage: number) => void): void {
    this.onStrikeDamage = callback;
  }

  static enterTargetingMode(playerPosition: THREE.Vector3): boolean {
    // Check if at least one turret is deployed
    if (!TurretManager.hasActiveTurret()) {
      return false; // Cannot use air strike without turret
    }

    if (this.charges <= 0) return false;
    if (this.cooldownTimer > 0) return false;
    if (this.isActive) return false;

    this.isActive = true;
    this.targetPosition = playerPosition.clone();
    this.enterGraceTimer = 0.35; // same click that armed the tablet must not drop a strike

    // Position bird's-eye camera above player
    if (this.airstrikeCamera) {
      this.airstrikeCamera.position.set(
        playerPosition.x,
        this.TARGETING_HEIGHT,
        playerPosition.z
      );
      this.airstrikeCamera.lookAt(playerPosition.x, 0, playerPosition.z);
    }

    return true;
  }

  static exitTargetingMode(): void {
    this.isActive = false;
    this.targetPosition = null;
  }

  /** The bird's-eye camera used while targeting (null when not targeting). */
  static getTargetingCamera(): THREE.PerspectiveCamera | null {
    return this.isActive ? this.airstrikeCamera : null;
  }

  static updateTargeting(delta: number, input: {
    forward: number;
    strafe: number;
    shoot: boolean;
    aimDownSights?: boolean;
    lookDeltaX: number;
    lookDeltaY: number;
  }): THREE.Camera | null {
    if (!this.isActive || !this.airstrikeCamera || !this.targetPosition) return null;

    // Right-click backs out of the targeting view
    if (input.aimDownSights) {
      this.exitTargetingMode();
      return null;
    }

    // Move targeting camera with input (WASD moves the target area)
    const moveSpeed = 40; // m/s in targeting mode
    const moveX = -input.strafe * moveSpeed * delta;
    const moveZ = -input.forward * moveSpeed * delta;

    this.targetPosition.x += moveX;
    this.targetPosition.z += moveZ;

    // Clamp to targeting range from player
    if (this.playerCamera) {
      const playerPos = this.playerCamera.position;
      const dx = this.targetPosition.x - playerPos.x;
      const dz = this.targetPosition.z - playerPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > this.TARGETING_RANGE) {
        const factor = this.TARGETING_RANGE / dist;
        this.targetPosition.x = playerPos.x + dx * factor;
        this.targetPosition.z = playerPos.z + dz * factor;
      }
    }

    // Update camera to follow target
    this.airstrikeCamera.position.x = this.targetPosition.x;
    this.airstrikeCamera.position.z = this.targetPosition.z;
    this.airstrikeCamera.lookAt(this.targetPosition.x, 0, this.targetPosition.z);

    // Fire strike on shoot (after the arming grace period)
    if (this.enterGraceTimer > 0) {
      this.enterGraceTimer -= delta;
    } else if (input.shoot && this.charges > 0 && this.cooldownTimer <= 0) {
      this.executeStrike(this.targetPosition.clone());
      // Strike away — return to first person so the operator sees the impact
      this.exitTargetingMode();
      return null;
    }

    return this.airstrikeCamera;
  }

  static executeStrike(position: THREE.Vector3): void {
    if (this.charges <= 0 || this.cooldownTimer > 0) return;

    this.charges--;
    this.cooldownTimer = this.COOLDOWN;

    // Create pending strike for visual feedback
    this.pendingStrike = {
      position: position.clone(),
      radius: this.STRIKE_RADIUS,
      timestamp: performance.now()
    };

    // Visual effect: targeting beam
    this.createStrikeVisual(position);

    // Damage zombies in radius via callback
    if (this.onStrikeDamage) {
      this.onStrikeDamage(position, this.STRIKE_RADIUS, this.STRIKE_DAMAGE);
    }
  }

  private static createStrikeVisual(position: THREE.Vector3): void {
    if (!this.scene || !this.strikeEffect) return;

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;
    const fxScale = isTouch ? 1.5 : 1.0; // Larger on mobile for visibility

    // Warning marker on ground (appears before strike)
    const markerGeometry = new THREE.RingGeometry(this.STRIKE_RADIUS - 0.5, this.STRIKE_RADIUS + 0.5, 32);
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: 0xff3300,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(position.x, 0.1, position.z);
    this.strikeEffect.add(marker);

    // Incoming missile trail (from sky) - MUCH THICKER AND BRIGHTER
    const trailRadius = 0.6 * fxScale;
    const trailGeometry = new THREE.CylinderGeometry(trailRadius * 0.5, trailRadius * 1.5, this.TARGETING_HEIGHT, 12);
    const trailMaterial = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const trail = new THREE.Mesh(trailGeometry, trailMaterial);
    trail.position.set(position.x, this.TARGETING_HEIGHT / 2, position.z);
    this.strikeEffect.add(trail);

    // Animate warning pulse then explosion
    let pulsePhase = 0;
    const pulseInterval = setInterval(() => {
      pulsePhase += 0.3;
      markerMaterial.opacity = 0.5 + 0.4 * Math.sin(pulsePhase * 4);
      marker.scale.setScalar(1 + 0.15 * Math.sin(pulsePhase * 4));
    }, 50);

    // Impact after 1.5s delay
    setTimeout(() => {
      clearInterval(pulseInterval);
      this.strikeEffect?.remove(marker);
      this.strikeEffect?.remove(trail);
      this.createExplosion(position);
    }, 1500);
  }

  private static createExplosion(position: THREE.Vector3): void {
    if (!this.scene || !this.strikeEffect) return;

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;
    const effectsQuality = (() => { try { const { GraphicsSettings } = require('../core/GraphicsSettings'); return GraphicsSettings.get().effectsQuality; } catch { return 'LOW'; } })();
    const fxScale = isTouch ? 0.5 : 1.0; // Base scale for mobile

    // Ground scorch mark
    const scorchGeometry = new THREE.CircleGeometry(this.STRIKE_RADIUS, 64);
    const scorchMaterial = new THREE.MeshBasicMaterial({
      color: 0x1a0a00,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const scorch = new THREE.Mesh(scorchGeometry, scorchMaterial);
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.set(position.x, 0.05, position.z);
    this.strikeEffect.add(scorch);

    // Expanding shockwave ring
    const ringGeometry = new THREE.RingGeometry(1, 2, 64);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(position.x, 0.2, position.z);
    this.strikeEffect.add(ring);

    // FIRE PARTICLES - MUCH LARGER AND MORE VISIBLE
    const baseParticleCount = 80;
    const particleCount = Math.round(baseParticleCount * fxScale * (effectsQuality === 'LOW' ? 0.5 : effectsQuality === 'MEDIUM' ? 0.75 : 1.0));
    const particleSize = isTouch ? 0.8 : 0.6; // Much larger on mobile
    const particleGeometry = new THREE.SphereGeometry(particleSize, 8, 8);
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending, // Much more visible!
      depthWrite: false,
    });

    for (let i = 0; i < particleCount; i++) {
      const particle = new THREE.Mesh(particleGeometry, particleMaterial.clone());
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = Math.random() * this.STRIKE_RADIUS * 0.9;
      particle.position.set(
        position.x + Math.cos(angle) * radius,
        1.0 + Math.random() * 4, // Start higher up
        position.z + Math.sin(angle) * radius
      );
      this.strikeEffect.add(particle);

      // Animate particle - rise up and expand
      const targetY = 12 + Math.random() * 8; // Rise higher
      const startY = particle.position.y;
      const duration = 1.2 + Math.random() * 0.8;
      const startTime = performance.now();

      const animateParticle = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        particle.position.y = startY + (targetY - startY) * eased;
        // Expand as they rise
        const scale = 1 + progress * 2;
        particle.scale.setScalar(scale);
        particle.material.opacity = 1 - progress;

        if (progress < 1) {
          requestAnimationFrame(animateParticle);
        } else {
          this.strikeEffect?.remove(particle);
        }
      };
      animateParticle();
    }

    // Animate shockwave
    let shockTime = 0;
    const shockDuration = 0.8;
    const animateShockwave = () => {
      shockTime += 1/60;
      const progress = shockTime / shockDuration;
      if (progress <= 1) {
        ring.scale.setScalar(1 + progress * this.STRIKE_RADIUS * 1.2);
        ringMaterial.opacity = 0.9 * (1 - progress);
        requestAnimationFrame(animateShockwave);
      } else {
        this.strikeEffect?.remove(ring);
      }
    };
    animateShockwave();

    // Fade scorch mark over 10 seconds
    setTimeout(() => {
      let fadeTime = 0;
      const fadeDuration = 3;
      const fadeScorch = () => {
        fadeTime += 1/60;
        const progress = fadeTime / fadeDuration;
        if (progress <= 1) {
          scorchMaterial.opacity = 0.9 * (1 - progress);
          requestAnimationFrame(fadeScorch);
        } else {
          this.strikeEffect?.remove(scorch);
        }
      };
      fadeScorch();
    }, 10000);
  }

  static update(delta: number): void {
    if (this.cooldownTimer > 0) {
      this.cooldownTimer = Math.max(0, this.cooldownTimer - delta);
    }
  }

  static getCharges(): number {
    return this.charges;
  }

  static getMaxCharges(): number {
    return this.maxCharges;
  }

  /** Sync runtime charges with the persistent strike inventory. */
  static setCharges(count: number): void {
    this.charges = Math.max(0, Math.floor(count));
    this.maxCharges = Math.max(this.maxCharges, this.charges);
  }

  static getCooldown(): number {
    return this.cooldownTimer;
  }

  static getCooldownMax(): number {
    return this.COOLDOWN;
  }

  static isInTargetingMode(): boolean {
    return this.isActive;
  }

  static getTargetPosition(): THREE.Vector3 | null {
    return this.targetPosition ? this.targetPosition.clone() : null;
  }

  static getTargetingRange(): number {
    return this.TARGETING_RANGE;
  }

  static getStrikeRadius(): number {
    return this.STRIKE_RADIUS;
  }

  static getStrikeDamage(): number {
    return this.STRIKE_DAMAGE;
  }

  static canUseAirStrike(): boolean {
    return TurretManager.hasActiveTurret() && this.charges > 0 && this.cooldownTimer <= 0;
  }

  static reset(): void {
    this.isActive = false;
    this.targetPosition = null;
    this.charges = this.maxCharges;
    this.cooldownTimer = 0;
    this.enterGraceTimer = 0;
    this.pendingStrike = null;
    if (this.strikeEffect) {
      this.strikeEffect.clear();
    }
  }

  static onResize(aspect: number): void {
    if (this.airstrikeCamera) {
      this.airstrikeCamera.aspect = aspect;
      this.airstrikeCamera.updateProjectionMatrix();
    }
  }
}