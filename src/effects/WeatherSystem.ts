import * as THREE from 'three';
import { soundFx } from '../audio/SoundEffects';
import { GraphicsSettings, getParticleScale } from '../core/GraphicsSettings';

export type WeatherType = 'HEAVY_RAIN' | 'ACID_STORM' | 'DENSE_FOG' | 'ASH_FALL' | 'CLEAR_NIGHT' | 'SUNNY_DAY' | 'AFTERNOON_RAIN' | 'GOLDEN_AFTERNOON';

export interface WeatherState {
  type: WeatherType;
  displayName: string;
  hazardLevel: 'LOW' | 'MODERATE' | 'SEVERE' | 'CRITICAL';
  windSpeed: number; // km/h
  rainIntensity: number; // 0 to 1
  fogDensity: number;
  lightningFrequency: number; // chance per minute
  description: string;
  icon: string;
}

export const WEATHER_CONFIGS: Record<WeatherType, WeatherState> = {
  SUNNY_DAY: {
    type: 'SUNNY_DAY',
    displayName: 'BRIGHT SUNNY DAY',
    hazardLevel: 'LOW',
    windSpeed: 8,
    rainIntensity: 0.0,
    fogDensity: 0.005,
    lightningFrequency: 0.0,
    description: 'High-visibility clear midday sun illuminating the quarantine district. Crisp sightlines.',
    icon: '☀️',
  },
  AFTERNOON_RAIN: {
    type: 'AFTERNOON_RAIN',
    displayName: 'AFTERNOON DRIZZLE & CLOUDS',
    hazardLevel: 'LOW',
    windSpeed: 16,
    rainIntensity: 0.5,
    fogDensity: 0.015,
    lightningFrequency: 0.6,
    description: 'Overcast afternoon precipitation. Wet pavement reflections under diffused daylight.',
    icon: '🌦️',
  },
  GOLDEN_AFTERNOON: {
    type: 'GOLDEN_AFTERNOON',
    displayName: 'GOLDEN HOUR AFTERNOON',
    hazardLevel: 'LOW',
    windSpeed: 10,
    rainIntensity: 0.0,
    fogDensity: 0.01,
    lightningFrequency: 0.0,
    description: 'Warm late-afternoon sun casting amber tones and dramatic long shadows.',
    icon: '🌅',
  },
  HEAVY_RAIN: {
    type: 'HEAVY_RAIN',
    displayName: 'URBAN DOWNPOUR & THUNDER',
    hazardLevel: 'MODERATE',
    windSpeed: 28,
    rainIntensity: 0.85,
    fogDensity: 0.028,
    lightningFrequency: 5.5,
    description: 'Heavy precipitation reducing visibility. Wet asphalt increases tactical reflections.',
    icon: '🌧️',
  },
  ACID_STORM: {
    type: 'ACID_STORM',
    displayName: 'CORROSIVE ACID STORM',
    hazardLevel: 'CRITICAL',
    windSpeed: 38,
    rainIntensity: 0.95,
    fogDensity: 0.034,
    lightningFrequency: 7.0,
    description: 'Caustic chemical precipitation and toxic ground vapor from compromised bio-facilities.',
    icon: '☣️',
  },
  DENSE_FOG: {
    type: 'DENSE_FOG',
    displayName: 'BIOLOGICAL SMOG & EMBERS',
    hazardLevel: 'SEVERE',
    windSpeed: 14,
    rainIntensity: 0.15,
    fogDensity: 0.045,
    lightningFrequency: 1.0,
    description: 'Thick bio-aerosol fog severely limiting target acquisition. Burning fallout adrift.',
    icon: '🌫️',
  },
  ASH_FALL: {
    type: 'ASH_FALL',
    displayName: 'INCINERATION FALLOUT',
    hazardLevel: 'LOW',
    windSpeed: 18,
    rainIntensity: 0.0,
    fogDensity: 0.024,
    lightningFrequency: 0.5,
    description: 'Charred ash and smoldering embers falling from quarantined burn zones.',
    icon: '🔥',
  },
  CLEAR_NIGHT: {
    type: 'CLEAR_NIGHT',
    displayName: 'COLD MOONLIT CHILL',
    hazardLevel: 'LOW',
    windSpeed: 10,
    rainIntensity: 0.0,
    fogDensity: 0.018,
    lightningFrequency: 0.0,
    description: 'Freezing urban temperatures with clear visibility under moonlight.',
    icon: '🌙',
  },
};

export class WeatherSystem {
  private static scene: THREE.Scene | null = null;
  private static currentWeather: WeatherState = WEATHER_CONFIGS.HEAVY_RAIN;
  private static weatherTimer: number = 0;
  private static dynamicTransitionTimer: number = 180; // switch weather periodically

  // Rain particle system
  private static rainCount: number = 1800;
  private static rainGeometry: THREE.BufferGeometry | null = null;
  private static rainMaterial: THREE.PointsMaterial | null = null;
  private static rainPoints: THREE.Points | null = null;
  private static rainVelocities: Float32Array | null = null;

  // Embers / ash particles
  private static emberCount: number = 280;
  private static emberGeometry: THREE.BufferGeometry | null = null;
  private static emberMaterial: THREE.PointsMaterial | null = null;
  private static emberPoints: THREE.Points | null = null;

  // Ground splashes
  private static splashCount: number = 120;
  private static splashGeometry: THREE.BufferGeometry | null = null;
  private static splashMaterial: THREE.PointsMaterial | null = null;
  private static splashPoints: THREE.Points | null = null;
  private static splashLifes: Float32Array | null = null;

  // Lightning system
  private static lightningFlashTimer: number = 0;
  private static lightningActiveTime: number = 0;
  private static baseMoonIntensity: number = 1.8;
  private static baseFogColor: THREE.Color = new THREE.Color(0x0c1218);
  private static lightningLight: THREE.DirectionalLight | null = null;
  private static moonLightRef: THREE.DirectionalLight | null = null;
  private static ambientLightRef: THREE.AmbientLight | null = null;

  // Screen droplets state
  public static screenDroplets: { x: number; y: number; size: number; speed: number; life: number }[] = [];

  public static init(scene: THREE.Scene, moonLight?: THREE.DirectionalLight, ambientLight?: THREE.AmbientLight) {
    this.scene = scene;
    this.moonLightRef = moonLight || null;
    this.ambientLightRef = ambientLight || null;
    if (moonLight) {
      this.baseMoonIntensity = moonLight.intensity;
    }

    // Weather particles are one CPU sim loop each per frame; scale the counts
    // with the effects quality preset so weak phones keep the loop cheap.
    const isTouch =
      'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;
    const effects = GraphicsSettings.get().effectsQuality;
    
    // DRAMATICALLY reduced counts for mobile LOW
    // LOW: 300 rain, 50 embers, 20 splashes
    // MEDIUM: 600 rain, 100 embers, 40 splashes
    // HIGH: 1200 rain, 200 embers, 80 splashes
    // Desktop: full counts
    let weatherScale: number;
    if (isTouch) {
      switch (effects) {
        case 'LOW':
          weatherScale = 0.05; // ~90 rain particles (was 0.17)
          break;
        case 'MEDIUM':
          weatherScale = 0.1;  // ~180 rain particles (was 0.33)
          break;
        case 'HIGH':
          weatherScale = 0.2;  // ~360 rain particles (was 0.67)
          break;
        case 'ULTRA':
          weatherScale = 0.33; // ~600 rain particles (was 1.0)
          break;
        default:
          weatherScale = 0.1;
      }
    } else {
      weatherScale = 1.0;
    }
    
    if (weatherScale < 1) {
      this.rainCount = Math.round(this.rainCount * weatherScale);
      this.emberCount = Math.round(this.emberCount * weatherScale);
      this.splashCount = Math.round(this.splashCount * weatherScale);
    }

    // Secondary sudden lightning flash light
    this.lightningLight = new THREE.DirectionalLight(0xdbeafe, 0);
    this.lightningLight.position.set(20, 80, 20);
    scene.add(this.lightningLight);

    this.initRain();
    this.initEmbers();
    this.initSplashes();
    this.scheduleNextLightning();
  }

  private static initRain() {
    if (!this.scene) return;

    this.rainGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.rainCount * 3);
    this.rainVelocities = new Float32Array(this.rainCount * 3);

    for (let i = 0; i < this.rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 55;
      positions[i * 3 + 1] = Math.random() * 32;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 55;

      this.rainVelocities[i * 3] = (Math.random() - 0.5) * 1.5 - 2.5; // wind X
      this.rainVelocities[i * 3 + 1] = -(32 + Math.random() * 18); // fall Y
      this.rainVelocities[i * 3 + 2] = (Math.random() - 0.5) * 2.0; // wind Z
    }

    this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Dynamic procedural rain texture
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(8, 0, 8, 64);
      grad.addColorStop(0, 'rgba(200, 225, 255, 0)');
      grad.addColorStop(0.3, 'rgba(220, 235, 255, 0.4)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.95)');
      ctx.fillStyle = grad;
      ctx.fillRect(7, 0, 2, 64);
    }
    const rainTexture = new THREE.CanvasTexture(canvas);

    this.rainMaterial = new THREE.PointsMaterial({
      size: 0.6,
      map: rainTexture,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.rainPoints = new THREE.Points(this.rainGeometry, this.rainMaterial);
    this.scene.add(this.rainPoints);
  }

  private static initEmbers() {
    if (!this.scene) return;

    this.emberGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.emberCount * 3);

    for (let i = 0; i < this.emberCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 45;
      positions[i * 3 + 1] = Math.random() * 24;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 45;
    }

    this.emberGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Amber glowing ember texture
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const rad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      rad.addColorStop(0, 'rgba(255, 180, 60, 1)');
      rad.addColorStop(0.35, 'rgba(249, 115, 22, 0.8)');
      rad.addColorStop(1, 'rgba(220, 38, 38, 0)');
      ctx.fillStyle = rad;
      ctx.beginPath();
      ctx.arc(16, 16, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    const emberTexture = new THREE.CanvasTexture(canvas);

    this.emberMaterial = new THREE.PointsMaterial({
      size: 0.35,
      map: emberTexture,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.emberPoints = new THREE.Points(this.emberGeometry, this.emberMaterial);
    this.scene.add(this.emberPoints);
  }

  private static initSplashes() {
    if (!this.scene) return;

    this.splashGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.splashCount * 3);
    this.splashLifes = new Float32Array(this.splashCount);

    for (let i = 0; i < this.splashCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 35;
      positions[i * 3 + 1] = 0.05;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 35;
      this.splashLifes[i] = Math.random();
    }

    this.splashGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Circular ground splash ring
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = 'rgba(210, 230, 255, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(16, 16, 13, 0, Math.PI * 2);
      ctx.stroke();
    }
    const splashTexture = new THREE.CanvasTexture(canvas);

    this.splashMaterial = new THREE.PointsMaterial({
      size: 0.55,
      map: splashTexture,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.splashPoints = new THREE.Points(this.splashGeometry, this.splashMaterial);
    this.scene.add(this.splashPoints);
  }

  public static setWeather(type: WeatherType) {
    this.currentWeather = WEATHER_CONFIGS[type] || WEATHER_CONFIGS.HEAVY_RAIN;
    this.applyWeatherVisuals();
  }

  public static getCurrentWeather(): WeatherState {
    return this.currentWeather;
  }

  /** Returns a random weather with 90% chance of clear weather, 10% rain */
  public static getRandomWeather(): WeatherState {
    const clearTypes: WeatherType[] = ['SUNNY_DAY', 'GOLDEN_AFTERNOON', 'CLEAR_NIGHT', 'SUNNY_DAY', 'GOLDEN_AFTERNOON'];
    const rainTypes: WeatherType[] = ['AFTERNOON_RAIN', 'HEAVY_RAIN'];
    
    const roll = Math.random();
    if (roll < 0.9) {
      // 90% chance of clear weather
      return WEATHER_CONFIGS[clearTypes[Math.floor(Math.random() * clearTypes.length)]];
    } else {
      // 10% chance of rain
      return WEATHER_CONFIGS[rainTypes[Math.floor(Math.random() * rainTypes.length)]];
    }
  }

  /** Initialize weather with 90% clear / 10% rain probability */
  public static initRandomWeather(): WeatherState {
    const weather = this.getRandomWeather();
    this.currentWeather = weather;
    this.applyWeatherVisuals();
    return weather;
  }

  public static cycleEnvironment(): WeatherState {
    const cycleList: WeatherType[] = ['SUNNY_DAY', 'AFTERNOON_RAIN', 'GOLDEN_AFTERNOON', 'CLEAR_NIGHT', 'HEAVY_RAIN'];
    const currIdx = cycleList.indexOf(this.currentWeather.type);
    const nextIdx = (currIdx + 1) % cycleList.length;
    this.setWeather(cycleList[nextIdx]);
    return this.currentWeather;
  }

  public static setMissionWeather(missionId: number) {
    // Each mission gets weather that matches its map's authored atmosphere
    switch (missionId) {
      case 1:
        // Quarantine District: Bright sunny day with high visibility
        this.setWeather('SUNNY_DAY');
        break;
      case 2:
        // Substation: Afternoon rain shower and overcast clouds
        this.setWeather('AFTERNOON_RAIN');
        break;
      case 3:
        // Freight Depot: Warm golden afternoon
        this.setWeather('GOLDEN_AFTERNOON');
        break;
      case 4:
        // Checkpoint Bravo: Clear sunny day
        this.setWeather('SUNNY_DAY');
        break;
      case 5:
        // Central Plaza: Apocalyptic storm
        this.setWeather('HEAVY_RAIN');
        break;
      case 6:
        // Operation Ironclad (Checkpoint Bravo): Sunny with drifting clouds
        this.setWeather('SUNNY_DAY');
        break;
      case 7:
        // Blackout Protocol (Substation): Pitch-dark night operation
        this.setWeather('CLEAR_NIGHT');
        break;
      case 8:
        // Horde Breach (Freight Depot): Toxic biohazard fog with burning embers
        this.setWeather('DENSE_FOG');
        break;
      case 9:
        // Final Countdown (Central Plaza): Ash-choked apocalypse
        this.setWeather('ASH_FALL');
        break;
      case 10:
        // Airfield extraction: Cold clear night under floodlights
        this.setWeather('CLEAR_NIGHT');
        break;
      default:
        this.setWeather('SUNNY_DAY');
    }
  }

  private static applyWeatherVisuals() {
    if (!this.rainMaterial || !this.emberMaterial) return;

    // NOTE: scene.fog / scene.background / light intensities are owned by the
    // mission environment (EnvironmentBuilder) so each map keeps its authored
    // mood. Weather only drives precipitation, embers and lightning tints.
    if (this.currentWeather.type === 'SUNNY_DAY') {
      this.rainMaterial.color.setHex(0xe2e8f0);
    } else if (this.currentWeather.type === 'AFTERNOON_RAIN') {
      this.rainMaterial.color.setHex(0xe2e8f0);
    } else if (this.currentWeather.type === 'GOLDEN_AFTERNOON') {
      this.rainMaterial.color.setHex(0xfde68a);
    } else if (this.currentWeather.type === 'ACID_STORM') {
      this.rainMaterial.color.setHex(0xa3e635); // Toxic green rain
      this.emberMaterial.color.setHex(0x84cc16);
      if (this.lightningLight) this.lightningLight.color.setHex(0xbbf7d0);
    } else if (this.currentWeather.type === 'ASH_FALL') {
      this.rainMaterial.color.setHex(0x94a3b8);
      this.emberMaterial.color.setHex(0xf97316); // Bright orange burning embers
      if (this.lightningLight) this.lightningLight.color.setHex(0xfef08a);
    } else if (this.currentWeather.type === 'DENSE_FOG') {
      this.rainMaterial.color.setHex(0xcfd8dc);
      this.emberMaterial.color.setHex(0xf59e0b);
      if (this.lightningLight) this.lightningLight.color.setHex(0xe2e8f0);
    } else {
      this.rainMaterial.color.setHex(0x93c5fd); // Cold electric blue
      this.emberMaterial.color.setHex(0xfb923c);
      if (this.lightningLight) this.lightningLight.color.setHex(0xe0f2fe);
    }

    if (this.rainPoints) {
      this.rainPoints.visible = this.currentWeather.rainIntensity > 0.05;
    }
    if (this.splashPoints) {
      this.splashPoints.visible = this.currentWeather.rainIntensity > 0.2;
    }
    if (this.emberPoints) {
      this.emberPoints.visible = this.currentWeather.type === 'ASH_FALL' || this.currentWeather.type === 'DENSE_FOG';
    }
  }

  private static scheduleNextLightning() {
    const freq = this.currentWeather.lightningFrequency;
    if (freq <= 0) {
      this.lightningFlashTimer = 99999;
      return;
    }
    // Random delay between lightning strikes (e.g. 5 to 15 seconds during thunderstorm)
    const baseInterval = 60 / freq;
    this.lightningFlashTimer = baseInterval * (0.5 + Math.random() * 0.9);
  }

  public static triggerLightning() {
    this.lightningActiveTime = 0.24; // duration of flash
    if (this.lightningLight) {
      this.lightningLight.intensity = 8.5;
    }
    if (this.scene?.fog && this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.setHex(this.currentWeather.type === 'ACID_STORM' ? 0x22c55e : 0xe0f2fe);
    }
  }

  public static update(delta: number, playerPos: THREE.Vector3) {
    this.weatherTimer += delta;

    // Weather stays as authored per mission — no random mood-breaking switches.
    // The transition timer is kept only to refresh the current weather visuals.
    this.dynamicTransitionTimer -= delta;
    if (this.dynamicTransitionTimer <= 0) {
      this.dynamicTransitionTimer = 140 + Math.random() * 60;
      this.applyWeatherVisuals();
    }

    // 1. Rain update around player position
    if (this.rainPoints && this.rainGeometry && this.rainVelocities && this.currentWeather.rainIntensity > 0.05) {
      const posAttr = this.rainGeometry.getAttribute('position') as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;
      const count = this.rainCount;
      const rainSpeed = 1.0 + this.currentWeather.rainIntensity * 0.5;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        // Update positions with velocities
        positions[i3] += this.rainVelocities[i3] * delta * rainSpeed;
        positions[i3 + 1] += this.rainVelocities[i3 + 1] * delta * rainSpeed;
        positions[i3 + 2] += this.rainVelocities[i3 + 2] * delta * rainSpeed;

        // Ground hit: recycle above player
        if (positions[i3 + 1] <= 0.05) {
          positions[i3] = playerPos.x + (Math.random() - 0.5) * 50;
          positions[i3 + 1] = playerPos.y + 20 + Math.random() * 12;
          positions[i3 + 2] = playerPos.z + (Math.random() - 0.5) * 50;
        }

        // Horizontal bounding box wrap around player
        if (Math.abs(positions[i3] - playerPos.x) > 30) {
          positions[i3] = playerPos.x + (Math.random() - 0.5) * 45;
        }
        if (Math.abs(positions[i3 + 2] - playerPos.z) > 30) {
          positions[i3 + 2] = playerPos.z + (Math.random() - 0.5) * 45;
        }
      }
      posAttr.needsUpdate = true;
    }

    // 2. Ground splash rings
    if (this.splashPoints && this.splashGeometry && this.splashLifes && this.currentWeather.rainIntensity > 0.2) {
      const posAttr = this.splashGeometry.getAttribute('position') as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;
      const count = this.splashCount;

      for (let i = 0; i < count; i++) {
        this.splashLifes[i] += delta * 3.5;
        if (this.splashLifes[i] >= 1.0) {
          this.splashLifes[i] = 0;
          positions[i * 3] = playerPos.x + (Math.random() - 0.5) * 32;
          positions[i * 3 + 1] = 0.04;
          positions[i * 3 + 2] = playerPos.z + (Math.random() - 0.5) * 32;
        }
      }
      posAttr.needsUpdate = true;
    }

    // 3. Ash & Embers update
    if (this.emberPoints && this.emberGeometry && (this.currentWeather.type === 'ASH_FALL' || this.currentWeather.type === 'DENSE_FOG')) {
      const posAttr = this.emberGeometry.getAttribute('position') as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;
      const count = this.emberCount;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        // Swaying turbulence
        positions[i3] += Math.sin(this.weatherTimer * 1.5 + i) * 0.8 * delta + (this.currentWeather.windSpeed * 0.05 * delta);
        positions[i3 + 1] -= (1.8 + Math.sin(i)) * delta;
        positions[i3 + 2] += Math.cos(this.weatherTimer * 1.2 + i) * 0.8 * delta;

        if (positions[i3 + 1] <= 0.05) {
          positions[i3] = playerPos.x + (Math.random() - 0.5) * 35;
          positions[i3 + 1] = playerPos.y + 14 + Math.random() * 8;
          positions[i3 + 2] = playerPos.z + (Math.random() - 0.5) * 35;
        }
      }
      posAttr.needsUpdate = true;
    }

    // 4. Lightning flash logic
    if (this.currentWeather.lightningFrequency > 0) {
      this.lightningFlashTimer -= delta;
      if (this.lightningFlashTimer <= 0) {
        this.triggerLightning();
        this.scheduleNextLightning();
      }
    }

    if (this.lightningActiveTime > 0) {
      this.lightningActiveTime -= delta;
      // Strobe flicker
      const flicker = Math.sin(this.lightningActiveTime * 45) > 0 ? 1 : 0.4;
      if (this.lightningLight) {
        this.lightningLight.intensity = 8.5 * flicker * (this.lightningActiveTime / 0.24);
      }
      if (this.lightningActiveTime <= 0) {
        if (this.lightningLight) {
          this.lightningLight.intensity = 0;
        }
        // Restore scene fog color
        if (this.scene?.fog && this.scene.fog instanceof THREE.Fog) {
          this.scene.fog.color.set(this.baseFogColor);
        }
      }
    }

    // 5. Screen Visor Droplets during rain
    if (this.currentWeather.rainIntensity > 0.3) {
      // Chance to spawn new visor droplet
      if (Math.random() < this.currentWeather.rainIntensity * 0.35 && this.screenDroplets.length < 16) {
        this.screenDroplets.push({
          x: 10 + Math.random() * 80,
          y: 10 + Math.random() * 70,
          size: 6 + Math.random() * 12,
          speed: 18 + Math.random() * 25,
          life: 2.5 + Math.random() * 2.5,
        });
      }

      // Update screen droplets
      for (let i = this.screenDroplets.length - 1; i >= 0; i--) {
        const drop = this.screenDroplets[i];
        drop.life -= delta;
        drop.y += drop.speed * delta * 0.2; // Drip down visor slowly
        if (drop.life <= 0 || drop.y > 98) {
          this.screenDroplets.splice(i, 1);
        }
      }
    } else if (this.screenDroplets.length > 0) {
      this.screenDroplets = [];
    }
  }

  public static setBaseFogColor(color: number) {
    this.baseFogColor.setHex(color);
  }

  public static clearAll() {
    this.screenDroplets = [];
    if (this.lightningLight) {
      this.lightningLight.intensity = 0;
    }
  }

  /** Reinitialize weather particle counts when graphics quality changes. */
  public static reinitParticleCounts(): void {
    if (!this.scene) return;
    
    const isTouch =
      'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;
    const effects = GraphicsSettings.get().effectsQuality;
    
    let weatherScale: number;
    if (isTouch) {
      switch (effects) {
        case 'LOW':
          weatherScale = 0.05;
          break;
        case 'MEDIUM':
          weatherScale = 0.1;
          break;
        case 'HIGH':
          weatherScale = 0.2;
          break;
        case 'ULTRA':
          weatherScale = 0.33;
          break;
        default:
          weatherScale = 0.1;
      }
    } else {
      weatherScale = 1.0;
    }
    
    // Dispose old geometries
    if (this.rainGeometry) this.rainGeometry.dispose();
    if (this.emberGeometry) this.emberGeometry.dispose();
    if (this.splashGeometry) this.splashGeometry.dispose();
    if (this.rainMaterial) this.rainMaterial.dispose();
    if (this.emberMaterial) this.emberMaterial.dispose();
    if (this.splashMaterial) this.splashMaterial.dispose();
    if (this.rainPoints) { this.scene.remove(this.rainPoints); this.rainPoints = null; }
    if (this.emberPoints) { this.scene.remove(this.emberPoints); this.emberPoints = null; }
    if (this.splashPoints) { this.scene.remove(this.splashPoints); this.splashPoints = null; }
    
    // Reset base counts
    this.rainCount = Math.round(1800 * weatherScale);
    this.emberCount = Math.round(280 * weatherScale);
    this.splashCount = Math.round(120 * weatherScale);
    
    // Recreate
    this.initRain();
    this.initEmbers();
    this.initSplashes();
  }
}
