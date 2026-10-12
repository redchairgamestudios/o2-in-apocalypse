export type GameScreen = 'COMPANY_INTRO' | 'MENU' | 'CUTSCENE' | 'PLAYING' | 'PAUSED' | 'ARSENAL' | 'MISSIONS' | 'SETTINGS' | 'VICTORY' | 'DEFEAT' | 'SPECIMEN' | 'MISSION10_ENDING';

export type Difficulty = 'EASY' | 'NORMAL' | 'HARD' | 'VERY HARD' | 'NIGHTMARE';

export type ZombieTypeKey = 'walker' | 'runner' | 'brute' | 'spitter' | 'crawler' | 'screamer' | 'bloater' | 'stalker' | 'enforcer' | 'colossus';
export type ZombieState = 'IDLE' | 'WANDER' | 'ALERT' | 'CHASE' | 'ATTACK' | 'STAGGER' | 'DEAD';

export type WeaponTypeKey = 'pistol' | 'shotgun' | 'rifle' | 'smg' | 'heavy' | 'sniper' | 'rocket' | 'katana' | 'airstrike';

export interface WeaponUpgradeLevel {
  damageLevel: number;
  magLevel: number;
  fireRateLevel: number;
  reloadLevel: number;
}

export interface WeaponConfig {
  id: WeaponTypeKey;
  name: string;
  category: string;
  baseDamage: number;
  pellets?: number;
  fireRateRpm: number;
  baseMagSize: number;
  maxReserveAmmo: number;
  baseReloadTime: number; // in seconds
  spread: number;
  recoil: number;
  headshotMultiplier: number;
  range: number;
  cost: number;
  unlockedByDefault: boolean;
  description: string;
  melee?: boolean;      // katana: infinite ammo, wide arc swing instead of hitscan
  projectile?: boolean; // rocket: launches an explosive projectile instead of hitscan
}

export interface ZombieConfig {
  type: ZombieTypeKey;
  name: string;
  maxHp: number;
  speed: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  rewardCredits: number;
  score: number;
  scale: number;
  eyeGlowColor: number;
  skinColor: number;
  clothColor: number;
  hasArmor?: boolean;
  isBoss?: boolean;
  bossTitle?: string;
}

export interface ObjectiveStep {
  id: string;
  title: string;
  description: string;
  type: 'reach_zone' | 'kill_count' | 'interact_object' | 'survive_time' | 'defeat_boss' | 'rescue_survivors' | 'collect_samples';
  targetCount?: number;
  currentCount?: number;
  targetPosition?: [number, number, number];
  targetRadius?: number;
  timerSeconds?: number;
}

export interface MissionWave {
  waveNumber: number;
  enemies: { type: ZombieTypeKey; count: number }[];
  spawnDelay: number;
}

export interface MissionConfig {
  id: number;
  title: string;
  subTitle: string;
  district: string;
  difficultyRecommended: Difficulty;
  briefing: string;
  baseRewardCredits: number;
  timeLimit?: number;
  objectives: ObjectiveStep[];
  waves?: MissionWave[];
}

export interface PickupItem {
  id: string;
  type: 'AMMO' | 'MEDKIT' | 'CREDITS';
  value: number;
  position: [number, number, number];
}

export interface GameStats {
  kills: number;
  headshots: number;
  shotsFired: number;
  shotsHit: number;
  damageTaken: number;
  creditsEarned: number;
  missionTime: number;
}

export type AllyOrder = 'FOLLOW_ME' | 'SEARCH_AND_DESTROY';

export interface DroneUpgrades {
  damageLevel: number;
  durationLevel: number;
  cooldownLevel: number;
  speedLevel: number;
}

export interface PlayerSaveData {
  credits: number;
  unlockedWeapons: WeaponTypeKey[];
  equippedWeapon: WeaponTypeKey;
  upgrades: Record<WeaponTypeKey, WeaponUpgradeLevel>;
  completedMissions: number[];
  highestMissionUnlocked: number;
  grenades: number;
  turrets: number;
  airstrikes: number;
  hasAllyRecruit: boolean;
  allyCount: number;
  isAllyDeployed?: boolean;
  hasPowerfulFlashlight: boolean;
  hasDrone?: boolean;
  droneUpgrades?: DroneUpgrades;
  settings: GameSettings;
}

export interface GameSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  mouseSensitivity: number;
  touchSensitivity: number;
  invertY: boolean;
  invertX?: boolean;
  graphicsQuality: 'LOW' | 'MEDIUM' | 'HIGH';
  showMinimap: boolean;
  showFps: boolean;
  vibrationEnabled: boolean;
  aimAssist: boolean;
}

export interface HitResult {
  hit: boolean;
  zone: 'HEAD' | 'TORSO' | 'LIMB' | 'WEAKPOINT' | 'BARREL' | 'NONE';
  /** Which limb the bullet struck — drives location-specific dismemberment. */
  limb?: 'ARM_L' | 'ARM_R' | 'LEG_L' | 'LEG_R';
  damage: number;
  isFatal: boolean;
  targetId?: string;
  point?: [number, number, number];
}

export interface KillFeedEntry {
  id: string;
  killer: string;
  weapon: string;
  victim: string;
  isHeadshot: boolean;
  isBoss: boolean;
  timestamp: number;
}
