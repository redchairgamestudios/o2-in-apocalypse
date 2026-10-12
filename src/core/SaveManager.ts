import { PlayerSaveData, WeaponTypeKey, GameSettings, DroneUpgrades } from '../types';

const STORAGE_KEY = 'deadzone_outbreak_save_v1';

const DEFAULT_DRONE_UPGRADES: DroneUpgrades = {
  damageLevel: 0,
  durationLevel: 0,
  cooldownLevel: 0,
  speedLevel: 0,
};

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  sfxVolume: 0.9,
  musicVolume: 0.6,
  mouseSensitivity: 1.0,
  touchSensitivity: 1.2,
  invertY: false,
  invertX: false,
  graphicsQuality: 'HIGH',
  showMinimap: true,
  showFps: false,
  vibrationEnabled: true,
  aimAssist: true,
};

const DEFAULT_SAVE_DATA: PlayerSaveData = {
  credits: 450, // Starting cash bonus for vertical slice excitement
  unlockedWeapons: ['pistol', 'shotgun', 'rifle', 'smg', 'heavy', 'sniper', 'rocket', 'katana', 'airstrike'], // All weapons unlocked so player can swap to all guns!
  equippedWeapon: 'pistol',
  upgrades: {
    pistol: { damageLevel: 0, magLevel: 0, fireRateLevel: 0, reloadLevel: 0 },
    shotgun: { damageLevel: 0, magLevel: 0, fireRateLevel: 0, reloadLevel: 0 },
    rifle: { damageLevel: 0, magLevel: 0, fireRateLevel: 0, reloadLevel: 0 },
    smg: { damageLevel: 0, magLevel: 0, fireRateLevel: 0, reloadLevel: 0 },
    heavy: { damageLevel: 0, magLevel: 0, fireRateLevel: 0, reloadLevel: 0 },
    sniper: { damageLevel: 0, magLevel: 0, fireRateLevel: 0, reloadLevel: 0 },
    rocket: { damageLevel: 0, magLevel: 0, fireRateLevel: 0, reloadLevel: 0 },
    katana: { damageLevel: 0, magLevel: 0, fireRateLevel: 0, reloadLevel: 0 },
    airstrike: { damageLevel: 0, magLevel: 0, fireRateLevel: 0, reloadLevel: 0 },
  },
  completedMissions: [],
  highestMissionUnlocked: 1,
  grenades: 3, // Start with 3 tactical frag grenades
  turrets: 1,  // Start with 1 deployable sentry turret
  airstrikes: 20, // Start with 20 satellite strike charges (generous for testing)
  hasAllyRecruit: false, // Up to 5 combat allies can be recruited in Arsenal
  allyCount: 0,
  isAllyDeployed: true,
  hasPowerfulFlashlight: false, // Military 3,500-lumen tactical searchlight ($500)
  hasDrone: false,
  droneUpgrades: { ...DEFAULT_DRONE_UPGRADES },
  settings: DEFAULT_SETTINGS,
};

export class SaveManager {
  private static data: PlayerSaveData = { ...DEFAULT_SAVE_DATA };

  public static load(): PlayerSaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = {
          ...DEFAULT_SAVE_DATA,
          ...parsed,
          unlockedWeapons: Array.from(new Set([
            ...(Array.isArray(parsed.unlockedWeapons) ? parsed.unlockedWeapons : []),
            'pistol', 'shotgun', 'rifle', 'smg', 'heavy', 'sniper', 'rocket', 'katana', 'airstrike'
          ] as WeaponTypeKey[])),
          allyCount: typeof parsed.allyCount === 'number' ? parsed.allyCount : (parsed.hasAllyRecruit ? 1 : 0),
          hasAllyRecruit: Boolean(parsed.hasAllyRecruit || (parsed.allyCount && parsed.allyCount > 0)),
          isAllyDeployed: parsed.isAllyDeployed !== false,
          airstrikes: typeof parsed.airstrikes === 'number' ? parsed.airstrikes : DEFAULT_SAVE_DATA.airstrikes,
          hasPowerfulFlashlight: Boolean(parsed.hasPowerfulFlashlight),
          hasDrone: Boolean(parsed.hasDrone),
          droneUpgrades: {
            ...DEFAULT_DRONE_UPGRADES,
            ...(parsed.droneUpgrades || {}),
          },
          upgrades: {
            ...DEFAULT_SAVE_DATA.upgrades,
            ...(parsed.upgrades || {}),
          },
          settings: {
            ...DEFAULT_SAVE_DATA.settings,
            ...(parsed.settings || {}),
          },
        };
      } else {
        this.data = JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
        this.save();
      }
    } catch {
      this.data = JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
    }
    return this.data;
  }

  public static save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Failed to save game data to localStorage:', e);
    }
  }

  public static get(): PlayerSaveData {
    return this.data;
  }

  public static addCredits(amount: number): number {
    this.data.credits = Math.max(0, this.data.credits + amount);
    this.save();
    return this.data.credits;
  }

  public static setCredits(amount: number): number {
    this.data.credits = Math.max(0, Math.floor(amount));
    this.save();
    return this.data.credits;
  }

  public static unlockWeapon(weapon: WeaponTypeKey): boolean {
    if (!this.data.unlockedWeapons.includes(weapon)) {
      this.data.unlockedWeapons.push(weapon);
      this.save();
      return true;
    }
    return false;
  }

  public static equipWeapon(weapon: WeaponTypeKey): void {
    if (this.data.unlockedWeapons.includes(weapon)) {
      this.data.equippedWeapon = weapon;
      this.save();
    }
  }

  public static upgradeWeaponStat(
    weapon: WeaponTypeKey,
    stat: 'damageLevel' | 'magLevel' | 'fireRateLevel' | 'reloadLevel',
    cost: number
  ): boolean {
    if (this.data.credits < cost) return false;
    if (!this.data.upgrades[weapon]) {
      this.data.upgrades[weapon] = { damageLevel: 0, magLevel: 0, fireRateLevel: 0, reloadLevel: 0 };
    }
    if (this.data.upgrades[weapon][stat] >= 5) return false;

    this.data.credits -= cost;
    this.data.upgrades[weapon][stat] += 1;
    this.save();
    return true;
  }

  public static useGrenade(): boolean {
    if (this.data.grenades > 0) {
      this.data.grenades--;
      this.save();
      return true;
    }
    return false;
  }

  public static addGrenades(count: number): void {
    this.data.grenades = Math.min(10, (this.data.grenades || 0) + count);
    this.save();
  }

  public static useTurret(): boolean {
    if (this.data.turrets > 0) {
      this.data.turrets--;
      this.save();
      return true;
    }
    return false;
  }

  public static addTurrets(count: number): void {
    this.data.turrets = Math.min(5, (this.data.turrets || 0) + count);
    this.save();
  }

  public static useAirstrike(): boolean {
    if (this.data.airstrikes > 0) {
      this.data.airstrikes--;
      this.save();
      return true;
    }
    return false;
  }

  public static addAirstrikes(count: number): void {
    this.data.airstrikes = Math.min(20, (this.data.airstrikes || 0) + count);
    this.save();
  }

  public static buyPowerfulFlashlight(): boolean {
    const COST = 500;
    if (this.data.credits >= COST && !this.data.hasPowerfulFlashlight) {
      this.data.credits -= COST;
      this.data.hasPowerfulFlashlight = true;
      this.save();
      return true;
    }
    return false;
  }

  public static buyDrone(): boolean {
    const COST = 1200;
    if (this.data.credits >= COST && !this.data.hasDrone) {
      this.data.credits -= COST;
      this.data.hasDrone = true;
      this.save();
      return true;
    }
    return false;
  }

  public static upgradeDroneStat(
    stat: 'damageLevel' | 'durationLevel' | 'cooldownLevel' | 'speedLevel',
    cost: number
  ): boolean {
    if (this.data.credits < cost) return false;
    if (!this.data.droneUpgrades) {
      this.data.droneUpgrades = { damageLevel: 0, durationLevel: 0, cooldownLevel: 0, speedLevel: 0 };
    }
    if (this.data.droneUpgrades[stat] >= 5) return false;

    this.data.credits -= cost;
    this.data.droneUpgrades[stat] += 1;
    this.save();
    return true;
  }

  public static getAllyRecruitCost(currentCount: number): number {
    // Progressive tactical deployment cost: 1st=$2500, 2nd=$3000, 3rd=$3500, 4th=$4000, 5th=$4500
    const costs = [2500, 3000, 3500, 4000, 4500];
    return costs[Math.min(costs.length - 1, Math.max(0, currentCount))];
  }

  public static recruitNextAlly(): boolean {
    const current = this.data.allyCount || (this.data.hasAllyRecruit ? 1 : 0);
    if (current >= 5) return false;
    const cost = this.getAllyRecruitCost(current);
    if (this.data.credits >= cost) {
      this.data.credits -= cost;
      this.data.allyCount = current + 1;
      this.data.hasAllyRecruit = true;
      this.save();
      return true;
    }
    return false;
  }

  public static recruitAlly(): boolean {
    return this.recruitNextAlly();
  }

  public static toggleAllyDeployment(enabled?: boolean): boolean {
    const nextState = enabled !== undefined ? enabled : !(this.data.isAllyDeployed !== false);
    this.data.isAllyDeployed = nextState;
    this.save();
    return this.data.isAllyDeployed;
  }

  public static removeAllySquad(): void {
    // Remove ally squad and reset ally count
    this.data.hasAllyRecruit = false;
    this.data.allyCount = 0;
    this.data.isAllyDeployed = false;
    this.save();
  }

  public static completeMission(missionId: number, nextMissionId?: number): void {
    if (!this.data.completedMissions.includes(missionId)) {
      this.data.completedMissions.push(missionId);
    }
    if (nextMissionId && nextMissionId > this.data.highestMissionUnlocked) {
      this.data.highestMissionUnlocked = nextMissionId;
    }
    this.save();
  }

  public static updateSettings(settings: Partial<GameSettings>): void {
    this.data.settings = {
      ...this.data.settings,
      ...settings,
    };
    this.save();
  }

  public static resetProgress(): void {
    this.data = JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
    this.save();
  }
}
