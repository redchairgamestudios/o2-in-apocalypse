import React, { useState } from 'react';
import { WeaponTypeKey, PlayerSaveData } from '../types';
import { WEAPON_DEFINITIONS, getUpgradeCost, UPGRADE_TIERS } from '../data/weapons';
import { SaveManager } from '../core/SaveManager';
import { soundFx } from '../audio/SoundEffects';
import { AllySoldier } from '../tactical/AllySoldier';
import { Shield, Wrench, X, Check, Lock, DollarSign, ChevronRight, Bomb, Crosshair, UserCheck, Plus, Coins, Trash2, Power, Flashlight, Radio, Zap } from 'lucide-react';

interface ArsenalModalProps {
  saveData: PlayerSaveData;
  onClose: () => void;
  onEquip: (weaponKey: WeaponTypeKey) => void;
  onDataChanged: () => void;
  onOpenBuyCoins?: () => void;
}

export const ArsenalModal: React.FC<ArsenalModalProps> = ({
  saveData,
  onClose,
  onEquip,
  onDataChanged,
  onOpenBuyCoins,
}) => {
  const [activeTab, setActiveTab] = useState<'weapons' | 'tactical' | 'drone'>('weapons');
  const [selectedKey, setSelectedKey] = useState<WeaponTypeKey>(saveData.equippedWeapon);
  const [isConfirmingDismiss, setIsConfirmingDismiss] = useState<boolean>(false);
  const selectedConfig = WEAPON_DEFINITIONS[selectedKey];
  const isUnlocked = saveData.unlockedWeapons.includes(selectedKey);
  const isEquipped = saveData.equippedWeapon === selectedKey;
  const currentUpgrades = saveData.upgrades[selectedKey] || {
    damageLevel: 0,
    magLevel: 0,
    fireRateLevel: 0,
    reloadLevel: 0,
  };

  const droneUpgrades = saveData.droneUpgrades || {
    damageLevel: 0,
    durationLevel: 0,
    cooldownLevel: 0,
    speedLevel: 0,
  };

  const getDroneStatCost = (lvl: number) => {
    const costs = [400, 750, 1200, 1750, 2400];
    return costs[Math.min(4, Math.max(0, lvl))];
  };

  const handleBuyDrone = () => {
    if (SaveManager.buyDrone()) {
      soundFx.playCashEarned();
      soundFx.playRadioTransmission();
      onDataChanged();
    }
  };

  const handleUpgradeDrone = (stat: 'damageLevel' | 'durationLevel' | 'cooldownLevel' | 'speedLevel') => {
    const lvl = droneUpgrades[stat] || 0;
    if (lvl >= 5) return;
    const cost = getDroneStatCost(lvl);
    if (SaveManager.upgradeDroneStat(stat, cost)) {
      soundFx.playCashEarned();
      onDataChanged();
    }
  };

  const handleUnlock = () => {
    if (saveData.credits >= selectedConfig.cost) {
      SaveManager.addCredits(-selectedConfig.cost);
      SaveManager.unlockWeapon(selectedKey);
      soundFx.playCashEarned();
      onDataChanged();
    }
  };

  const handleEquip = () => {
    if (isUnlocked) {
      SaveManager.equipWeapon(selectedKey);
      soundFx.playClick();
      onEquip(selectedKey);
      onDataChanged();
    }
  };

  const handleUpgrade = (stat: 'damageLevel' | 'magLevel' | 'fireRateLevel' | 'reloadLevel') => {
    const currentTier = currentUpgrades[stat];
    if (currentTier >= UPGRADE_TIERS.maxLevel) return;

    const cost = getUpgradeCost(currentTier);
    if (SaveManager.upgradeWeaponStat(selectedKey, stat, cost)) {
      soundFx.playCashEarned();
      onDataChanged();
    }
  };

  const handleBuyGrenade = () => {
    if (saveData.credits >= 150 && (saveData.grenades || 0) < 9) {
      SaveManager.addCredits(-150);
      SaveManager.addGrenades(1);
      soundFx.playCashEarned();
      onDataChanged();
    }
  };

  const handleBuyTurret = () => {
    if (saveData.credits >= 450 && (saveData.turrets || 0) < 5) {
      SaveManager.addCredits(-450);
      SaveManager.addTurrets(1);
      soundFx.playCashEarned();
      onDataChanged();
    }
  };

  const handleBuyAirstrike = () => {
    if (saveData.credits >= 400 && (saveData.airstrikes || 0) < 20) {
      SaveManager.addCredits(-400);
      SaveManager.addAirstrikes(1);
      soundFx.playCashEarned();
      soundFx.playRadioTransmission();
      onDataChanged();
    }
  };

  const handleRecruitAlly = () => {
    if (SaveManager.recruitAlly()) {
      soundFx.playCashEarned();
      soundFx.playRadioTransmission();
      onDataChanged();
    }
  };

  const handleToggleAllyDeployment = () => {
    SaveManager.toggleAllyDeployment();
    soundFx.playClick();
    onDataChanged();
  };

  const handleRemoveAlly = () => {
    if (!isConfirmingDismiss) {
      setIsConfirmingDismiss(true);
      soundFx.playClick();
      return;
    }
    // Confirmed dismissal
    SaveManager.removeAllySquad();
    AllySoldier.clear();
    soundFx.playCashEarned();
    setIsConfirmingDismiss(false);
    onDataChanged();
  };

  const handleCancelDismiss = () => {
    setIsConfirmingDismiss(false);
    soundFx.playClick();
  };

  const handleBuyFlashlight = () => {
    if (SaveManager.buyPowerfulFlashlight()) {
      soundFx.playCashEarned();
      soundFx.playFlashlightClick();
      onDataChanged();
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col p-4 md:p-8 short:p-3 pointer-events-auto overflow-y-auto select-none touch-manipulation">
      {/* Top Header */}
      <div className="flex flex-wrap justify-between items-center pb-4 border-b border-zinc-800 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Wrench className="w-6 h-6 text-amber-500 shrink-0" />
          <h2 className="font-teko text-2xl sm:text-3xl md:text-4xl font-bold tracking-wide text-white leading-none">
            MILITARY ARSENAL & SQUAD WORKBENCH
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-amber-500/40 px-3 py-1.5 rounded-lg">
            <DollarSign className="w-4 h-4 text-amber-400" />
            <span className="font-teko text-xl font-bold text-amber-400">{saveData.credits.toLocaleString()}</span>
          </div>

          {onOpenBuyCoins && (
            <button
              onClick={onOpenBuyCoins}
              className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:from-emerald-700 active:to-teal-700 text-white px-3 py-1.5 rounded-lg font-teko text-lg font-bold tracking-wider uppercase cursor-pointer shadow-md shadow-emerald-950/60 transition-all border border-emerald-400/50 min-h-[38px] touch-manipulation"
              title="Get free coins for upgrades and gear"
            >
              <Coins className="w-4 h-4 text-amber-300" />
              <span>+ BUY COINS</span>
              <span className="text-[9px] font-mono bg-black/40 px-1 py-0.2 rounded text-emerald-200 hidden sm:inline">
                FREE
              </span>
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-3 sm:mt-4 border-b border-zinc-800 pb-3">
        <button
          onClick={() => setActiveTab('weapons')}
          className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg font-teko text-lg sm:text-xl font-bold tracking-wide cursor-pointer transition-all flex items-center gap-2 ${
            activeTab === 'weapons'
              ? 'bg-red-600 text-white shadow-lg shadow-red-950/60 border border-red-400'
              : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          <Crosshair className="w-4 h-4" />
          FIREARMS & UPGRADES
        </button>

        <button
          onClick={() => setActiveTab('tactical')}
          className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg font-teko text-lg sm:text-xl font-bold tracking-wide cursor-pointer transition-all flex items-center gap-2 ${
            activeTab === 'tactical'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/60 border border-amber-400'
              : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          <Shield className="w-4 h-4" />
          TACTICAL GEAR & SQUAD ALLY
          {saveData.hasAllyRecruit && (
            <span className="text-[10px] font-mono bg-green-500/20 text-green-300 px-2 py-0.5 rounded border border-green-500/40">
              RECRUITED
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('drone')}
          className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg font-teko text-lg sm:text-xl font-bold tracking-wide cursor-pointer transition-all flex items-center gap-2 ${
            activeTab === 'drone'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-950/60 border border-cyan-400'
              : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          <Radio className="w-4 h-4" />
          MQ-7 COMBAT DRONE
          {saveData.hasDrone && (
            <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/40">
              ACQUIRED
            </span>
          )}
        </button>

        {onOpenBuyCoins && (
          <button
            onClick={onOpenBuyCoins}
            className="px-4 py-1.5 sm:py-2 rounded-lg font-teko text-lg sm:text-xl font-bold tracking-wide cursor-pointer transition-all flex items-center gap-2 bg-gradient-to-r from-emerald-950/80 to-zinc-900 hover:from-emerald-900 hover:to-zinc-800 text-emerald-300 border border-emerald-500/50 sm:ml-auto short:hidden"
          >
            <Coins className="w-4 h-4 text-emerald-400" />
            REQUISITION COINS (FREE)
          </button>
        )}
      </div>

      {activeTab === 'tactical' ? (
        /* TACTICAL GEAR & RECRUIT ALLY SECTION */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 flex-1">
          {/* Card 1: M67 Frag Grenades */}
          <div className="bg-zinc-950/90 border border-zinc-800 hover:border-zinc-700 p-5 rounded-xl flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-lg text-red-400">
                  <Bomb className="w-7 h-7" />
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-mono text-zinc-400 uppercase">INVENTORY</div>
                  <div className="font-teko text-3xl font-bold text-amber-400 leading-none">
                    {saveData.grenades || 0} / 9
                  </div>
                </div>
              </div>

              <h3 className="font-teko text-2xl font-bold text-white mb-1">M67 FRAG GRENADE</h3>
              <p className="font-military text-xs text-zinc-400 leading-relaxed mb-4">
                Heavy fragmentation explosive. Clears infected clusters with 420 radial kinetic shockwave across 8 meters. Press [G] or tap mobile button to throw.
              </p>

              <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800 space-y-1 mb-4 text-xs font-mono">
                <div className="flex justify-between text-zinc-300">
                  <span>Blast Damage:</span>
                  <span className="text-red-400 font-bold">420 HP (AoE)</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>Kill Radius:</span>
                  <span className="text-amber-400 font-bold">8.0 Meters</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>Keybind:</span>
                  <span className="text-yellow-300 font-bold">[G] or HUD</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleBuyGrenade}
              disabled={saveData.credits < 150 || (saveData.grenades || 0) >= 9}
              className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed font-teko text-xl font-bold text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              {(saveData.grenades || 0) >= 9 ? 'MAX STACK (9)' : 'PURCHASE GRENADE ($150)'}
            </button>
          </div>

          {/* Card 2: Autonomous Sentry Turrets */}
          <div className="bg-zinc-950/90 border border-zinc-800 hover:border-zinc-700 p-5 rounded-xl flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-blue-950/60 border border-blue-800/80 rounded-lg text-blue-400">
                  <Crosshair className="w-7 h-7" />
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-mono text-zinc-400 uppercase">INVENTORY</div>
                  <div className="font-teko text-3xl font-bold text-amber-400 leading-none">
                    {saveData.turrets || 0} / 5
                  </div>
                </div>
              </div>

              <h3 className="font-teko text-2xl font-bold text-white mb-1">AUTO DEFENSE TURRET</h3>
              <p className="font-military text-xs text-zinc-400 leading-relaxed mb-4">
                Dual-barrel 5.56mm autonomous sentry system. Employs laser targeting to lock onto zombies and suppress waves for 45 seconds. Press [T] or tap mobile button to deploy.
              </p>

              <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800 space-y-1 mb-4 text-xs font-mono">
                <div className="flex justify-between text-zinc-300">
                  <span>Battery Lifetime:</span>
                  <span className="text-blue-400 font-bold">45 Seconds</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>Fire Rate:</span>
                  <span className="text-yellow-400 font-bold">480 RPM Dual</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>Keybind:</span>
                  <span className="text-sky-300 font-bold">[T] or HUD</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleBuyTurret}
              disabled={saveData.credits < 450 || (saveData.turrets || 0) >= 5}
              className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed font-teko text-xl font-bold text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              {(saveData.turrets || 0) >= 5 ? 'MAX STACK (5)' : 'PURCHASE TURRET ($450)'}
            </button>
          </div>

          {/* Card 3: Satellite Air Strike Charges */}
          <div className="bg-zinc-950/90 border border-zinc-800 hover:border-orange-500/50 p-5 rounded-xl flex flex-col justify-between shadow-xl transition-colors">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-orange-950/60 border border-orange-600/80 rounded-lg text-orange-400">
                  <Zap className="w-7 h-7" />
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-mono text-zinc-400 uppercase">INVENTORY</div>
                  <div className="font-teko text-3xl font-bold text-amber-400 leading-none">
                    {saveData.airstrikes || 0} / 20
                  </div>
                </div>
              </div>

              <h3 className="font-teko text-2xl font-bold text-white mb-1">SATELLITE STRIKE CHARGE</h3>
              <p className="font-military text-xs text-zinc-400 leading-relaxed mb-4">
                Kinetic JDAM payload for the Ordinance Tablet. Annihilates everything in a 15-meter radius with 800 damage. Requires an active Sentry Turret uplink to designate targets.
              </p>

              <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800 space-y-1 mb-4 text-xs font-mono">
                <div className="flex justify-between text-zinc-300">
                  <span>Blast Damage:</span>
                  <span className="text-red-400 font-bold">800 HP (AoE)</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>Kill Radius:</span>
                  <span className="text-amber-400 font-bold">15.0 Meters</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>Requires:</span>
                  <span className="text-sky-300 font-bold">Active Turret Uplink</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleBuyAirstrike}
              disabled={saveData.credits < 400 || (saveData.airstrikes || 0) >= 20}
              className="w-full py-3 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed font-teko text-xl font-bold text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              {(saveData.airstrikes || 0) >= 20 ? 'MAX STACK (20)' : 'PURCHASE STRIKE ($400)'}
            </button>
          </div>

          {/* Card 4: Military High-Beam Tactical Flashlight ($500) */}
          <div className="bg-zinc-950/90 border border-zinc-800 hover:border-amber-500/50 p-5 rounded-xl flex flex-col justify-between shadow-xl relative overflow-hidden transition-colors">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-amber-950/60 border border-amber-600/80 rounded-lg text-amber-400">
                  <Flashlight className="w-7 h-7" />
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded border uppercase ${
                    saveData.hasPowerfulFlashlight
                      ? 'bg-green-950/80 text-green-300 border-green-600'
                      : 'bg-zinc-900 text-amber-400 border-amber-600/40'
                  }`}>
                    {saveData.hasPowerfulFlashlight ? 'EQUIPPED [ACTIVE]' : 'AVAILABLE ($500)'}
                  </span>
                </div>
              </div>

              <h3 className="font-teko text-2xl font-bold text-white mb-1">
                TACTICAL HEAVY FLASHLIGHT
              </h3>
              <p className="font-military text-xs text-zinc-400 leading-relaxed mb-4">
                Mil-Spec 3,500-lumen deep searchlight. Pierces dark alleys and fog up to 180 meters with wide-angle ambient flood illumination.
              </p>

              <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800 space-y-1 mb-4 text-xs font-mono">
                <div className="flex justify-between text-zinc-300">
                  <span>Beam Output:</span>
                  <span className="text-amber-400 font-bold">3,500 Lumens</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>Search Range:</span>
                  <span className="text-yellow-400 font-bold">180 Meters (2.2x)</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>Flood Fill:</span>
                  <span className="text-emerald-400 font-bold">80m Wide Angle</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>Mount / Keybind:</span>
                  <span className="text-sky-300 font-bold">[F] or HUD</span>
                </div>
              </div>
            </div>

            {saveData.hasPowerfulFlashlight ? (
              <div className="w-full py-3 rounded-lg bg-green-950/80 border border-green-600/80 text-green-300 font-teko text-xl font-bold flex items-center justify-center gap-2">
                <Check className="w-5 h-5 text-green-400" />
                3,500L SEARCHLIGHT MOUNTED
              </div>
            ) : (
              <button
                onClick={handleBuyFlashlight}
                disabled={saveData.credits < 500}
                className="w-full py-3 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed font-teko text-xl font-bold text-black shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-amber-400"
              >
                <DollarSign className="w-5 h-5 text-black stroke-[3]" />
                PURCHASE FLASHLIGHT ($500)
              </button>
            )}
          </div>

          {/* Card 5: Combat Ally Squad */}
          <div className="bg-zinc-950/90 border-2 border-amber-500/60 p-5 rounded-xl flex flex-col justify-between shadow-2xl relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-amber-950/60 border border-amber-600/80 rounded-lg text-amber-400">
                  <UserCheck className="w-7 h-7" />
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded border uppercase ${
                    saveData.hasAllyRecruit
                      ? saveData.isAllyDeployed !== false
                        ? 'bg-green-950/80 text-green-300 border-green-600'
                        : 'bg-zinc-900 text-yellow-400 border-yellow-600/50'
                      : 'bg-zinc-900 text-amber-400 border-amber-600/40'
                  }`}>
                    {saveData.hasAllyRecruit
                      ? saveData.isAllyDeployed !== false
                        ? `ACTIVE [${saveData.allyCount || 1}/5 DEPLOYED]`
                        : 'STANDBY [SOLO RUN]'
                      : 'AVAILABLE FOR RECRUIT'}
                  </span>
                </div>
              </div>

              <h3 className="font-teko text-2xl font-bold text-white mb-1">
                COMBAT ALLY SQUAD {saveData.hasAllyRecruit ? `(${saveData.allyCount || 1}/5)` : ''}
              </h3>
              <p className="font-military text-xs text-zinc-300 leading-relaxed mb-4">
                Elite special forces squadmates. Deploys with tactical body armor and assault rifles on combat missions. Follows formation, suppresses swarms, and provides tactical support.
              </p>

              <div className="bg-zinc-900/90 p-3 rounded-lg border border-zinc-800 space-y-1.5 mb-4 text-xs font-mono">
                <div className="flex justify-between text-zinc-300">
                  <span>Squad Size:</span>
                  <span className="text-amber-400 font-bold">{saveData.hasAllyRecruit ? `${saveData.allyCount || 1} / 5 Allies` : '0 (Recruitable)'}</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>Combat Health:</span>
                  <span className="text-green-400 font-bold">350 HP / Ally</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>Primary Weapon:</span>
                  <span className="text-amber-400 font-bold">Tactical M4A1</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>Deployment Status:</span>
                  <span className={saveData.isAllyDeployed !== false && saveData.hasAllyRecruit ? "text-emerald-300 font-bold" : "text-zinc-400 font-bold"}>
                    {saveData.hasAllyRecruit
                      ? saveData.isAllyDeployed !== false ? 'Active In Missions' : 'Standby (Solo Mode)'
                      : 'Not Recruited'}
                  </span>
                </div>
              </div>
            </div>

            {saveData.hasAllyRecruit ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-700">
                  <div>
                    <div className="font-teko text-lg text-white font-bold leading-tight">
                      MISSION DEPLOYMENT
                    </div>
                    <div className="text-[10px] font-military text-zinc-400">
                      {saveData.isAllyDeployed !== false ? 'Allies fight alongside you' : 'Solo operative (allies stand by)'}
                    </div>
                  </div>
                  <button
                    onClick={handleToggleAllyDeployment}
                    className={`px-3 py-1.5 rounded font-teko text-base font-bold border transition-all cursor-pointer ${
                      saveData.isAllyDeployed !== false
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-300 hover:bg-emerald-900'
                        : 'bg-zinc-800 border-zinc-600 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {saveData.isAllyDeployed !== false ? 'DEPLOYED [ACTIVE]' : 'STANDBY [SOLO]'}
                  </button>
                </div>

                {(saveData.allyCount || 1) < 5 && (
                  <button
                    onClick={handleRecruitAlly}
                    disabled={saveData.credits < SaveManager.getAllyRecruitCost(saveData.allyCount || 1)}
                    className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 active:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed font-teko text-xl font-bold text-black shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-amber-400"
                  >
                    <Plus className="w-4 h-4 text-black stroke-[3]" />
                    RECRUIT ALLY ({ (saveData.allyCount || 1) + 1 }/5) - ${SaveManager.getAllyRecruitCost(saveData.allyCount || 1).toLocaleString()}
                  </button>
                )}

                {isConfirmingDismiss ? (
                  <div className="space-y-1.5 animate-in fade-in duration-150">
                    <button
                      onClick={handleRemoveAlly}
                      className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-teko text-lg font-bold flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer shadow-lg shadow-red-950/80 border border-red-400 animate-pulse"
                      title="Confirm immediate squad dismissal"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                      CONFIRM DISMISSAL? (TAP TO CONFIRM)
                    </button>
                    <button
                      onClick={handleCancelDismiss}
                      className="w-full py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-teko text-sm font-bold cursor-pointer transition-colors"
                    >
                      CANCEL
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleRemoveAlly}
                    className="w-full py-2 rounded-lg bg-red-950/60 hover:bg-red-900 active:bg-red-950 border border-red-700 text-red-300 hover:text-red-100 font-teko text-base font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                    title="Remove combat ally squad feature from missions"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                    REMOVE ALLY FEATURE / DISMISS SQUAD
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={handleRecruitAlly}
                disabled={saveData.credits < SaveManager.getAllyRecruitCost(0)}
                className="w-full py-3.5 rounded-lg bg-amber-600 hover:bg-amber-500 active:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed font-teko text-2xl font-bold text-black shadow-xl shadow-amber-950/60 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-amber-400"
              >
                <DollarSign className="w-6 h-6 text-black stroke-[3]" />
                RECRUIT COMBAT ALLY (${SaveManager.getAllyRecruitCost(0).toLocaleString()})
              </button>
            )}
          </div>
        </div>
      ) : activeTab === 'drone' ? (
        /* MQ-7 COMBAT DRONE & UPGRADES SECTION */
        <div className="flex flex-col gap-6 mt-6 flex-1 min-h-0">
          {/* Drone Header Overview Banner */}
          <div className="bg-gradient-to-r from-cyan-950/90 via-zinc-950/95 to-zinc-900/90 border border-cyan-500/40 p-6 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="p-4 bg-cyan-950/80 border border-cyan-500/60 rounded-xl text-cyan-400 shadow-lg shadow-cyan-950/60">
                <Radio className="w-10 h-10 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-cyan-400 font-semibold tracking-wider uppercase">
                    AUTONOMOUS COMBAT UAV
                  </span>
                  {saveData.hasDrone ? (
                    <span className="text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-500/50 px-2 py-0.5 rounded">
                      ACTIVE SYSTEM
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-500/50 px-2 py-0.5 rounded">
                      LOCKED
                    </span>
                  )}
                </div>
                <h3 className="font-teko text-4xl font-bold text-white leading-none mt-0.5">
                  MQ-7 SHADOW COMBAT DRONE
                </h3>
                <p className="font-military text-xs text-zinc-300 mt-1 max-w-2xl leading-relaxed">
                  High-agility quadcopter equipped with high-cadence twin micro-rotary cannons, thermal targeting searchlight, and rechargeable flight capacitor. Deploys above the operative for 30s of tactical air support, then enters a 60s cooldown before next deployment.
                </p>
              </div>
            </div>

            {/* Requisition Button if locked */}
            {!saveData.hasDrone ? (
              <button
                onClick={handleBuyDrone}
                disabled={saveData.credits < 1200}
                className="w-full md:w-auto px-6 py-3.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed font-teko text-2xl font-bold text-black shadow-xl shadow-cyan-950/60 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-cyan-300 shrink-0"
              >
                <DollarSign className="w-6 h-6 text-black stroke-[3]" />
                REQUISITION DRONE ($1,200)
              </button>
            ) : (
              <div className="bg-zinc-900/90 border border-cyan-500/30 px-4 py-3 rounded-lg text-right shrink-0">
                <div className="text-[10px] font-mono text-zinc-400 uppercase">DEPLOYMENT STATUS</div>
                <div className="font-teko text-2xl font-bold text-cyan-400">READY IN COMBAT [T]</div>
              </div>
            )}
          </div>

          {/* Drone Technical Specs & Upgrade Workbenches */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Cannon Damage Upgrade */}
            <div className="bg-zinc-950/80 border border-zinc-800 p-5 rounded-xl flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-teko text-2xl font-bold text-white">TWIN ROTARY CANNONS</div>
                  <div className="font-mono text-xs text-cyan-400 font-bold">
                    {38 + (droneUpgrades.damageLevel || 0) * 12} DMG / SHOT
                  </div>
                </div>
                <p className="font-military text-xs text-zinc-400 mb-4">
                  High-velocity micro-slug munitions that tear through walker and runner swarms with rapid fire.
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80">
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <div
                      key={lvl}
                      className={`h-4 w-7 rounded-xs ${
                        (droneUpgrades.damageLevel || 0) >= lvl
                          ? 'bg-cyan-500 shadow-sm shadow-cyan-500/50'
                          : 'bg-zinc-800'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => handleUpgradeDrone('damageLevel')}
                  disabled={!saveData.hasDrone || (droneUpgrades.damageLevel || 0) >= 5 || saveData.credits < getDroneStatCost(droneUpgrades.damageLevel || 0)}
                  className="px-4 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-600 font-teko text-base font-bold text-amber-400 cursor-pointer"
                >
                  {(droneUpgrades.damageLevel || 0) >= 5 ? 'MAX TIER' : `UPGRADE ($${getDroneStatCost(droneUpgrades.damageLevel || 0)})`}
                </button>
              </div>
            </div>

            {/* 2. Battery Life / Flight Duration */}
            <div className="bg-zinc-950/80 border border-zinc-800 p-5 rounded-xl flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-teko text-2xl font-bold text-white">FLIGHT CAPACITOR DURATION</div>
                  <div className="font-mono text-xs text-emerald-400 font-bold">
                    {(30.0 + (droneUpgrades.durationLevel || 0) * 3.0).toFixed(1)}s AIR TIME
                  </div>
                </div>
                <p className="font-military text-xs text-zinc-400 mb-4">
                  High-density lithium-sulfur capacitor cells allowing prolonged autonomous aerial combat support.
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80">
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <div
                      key={lvl}
                      className={`h-4 w-7 rounded-xs ${
                        (droneUpgrades.durationLevel || 0) >= lvl
                          ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                          : 'bg-zinc-800'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => handleUpgradeDrone('durationLevel')}
                  disabled={!saveData.hasDrone || (droneUpgrades.durationLevel || 0) >= 5 || saveData.credits < getDroneStatCost(droneUpgrades.durationLevel || 0)}
                  className="px-4 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-600 font-teko text-base font-bold text-amber-400 cursor-pointer"
                >
                  {(droneUpgrades.durationLevel || 0) >= 5 ? 'MAX TIER' : `UPGRADE ($${getDroneStatCost(droneUpgrades.durationLevel || 0)})`}
                </button>
              </div>
            </div>

            {/* 3. Recharge Cooldown Reducer */}
            <div className="bg-zinc-950/80 border border-zinc-800 p-5 rounded-xl flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-teko text-2xl font-bold text-white">RAPID RECHARGE COIL</div>
                  <div className="font-mono text-xs text-amber-400 font-bold">
                    {(60.0 - (droneUpgrades.cooldownLevel || 0) * 5.0).toFixed(1)}s COOLDOWN
                  </div>
                </div>
                <p className="font-military text-xs text-zinc-400 mb-4">
                  Superconductive thermal dissipator coils reduce the idle recharge interval so the drone can deploy more often.
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80">
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <div
                      key={lvl}
                      className={`h-4 w-7 rounded-xs ${
                        (droneUpgrades.cooldownLevel || 0) >= lvl
                          ? 'bg-amber-500 shadow-sm shadow-amber-500/50'
                          : 'bg-zinc-800'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => handleUpgradeDrone('cooldownLevel')}
                  disabled={!saveData.hasDrone || (droneUpgrades.cooldownLevel || 0) >= 5 || saveData.credits < getDroneStatCost(droneUpgrades.cooldownLevel || 0)}
                  className="px-4 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-600 font-teko text-base font-bold text-amber-400 cursor-pointer"
                >
                  {(droneUpgrades.cooldownLevel || 0) >= 5 ? 'MAX TIER' : `UPGRADE ($${getDroneStatCost(droneUpgrades.cooldownLevel || 0)})`}
                </button>
              </div>
            </div>

            {/* 4. Rotor Turbine Speed */}
            <div className="bg-zinc-950/80 border border-zinc-800 p-5 rounded-xl flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-teko text-2xl font-bold text-white">TURBINE THRUST & AGILITY</div>
                  <div className="font-mono text-xs text-purple-400 font-bold">
                    +{((droneUpgrades.speedLevel || 0) * 15)}% VELOCITY
                  </div>
                </div>
                <p className="font-military text-xs text-zinc-400 mb-4">
                  Carbon-composite brushless rotor motors improve tracking response time and pursuit speed.
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80">
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <div
                      key={lvl}
                      className={`h-4 w-7 rounded-xs ${
                        (droneUpgrades.speedLevel || 0) >= lvl
                          ? 'bg-purple-500 shadow-sm shadow-purple-500/50'
                          : 'bg-zinc-800'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => handleUpgradeDrone('speedLevel')}
                  disabled={!saveData.hasDrone || (droneUpgrades.speedLevel || 0) >= 5 || saveData.credits < getDroneStatCost(droneUpgrades.speedLevel || 0)}
                  className="px-4 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-600 font-teko text-base font-bold text-amber-400 cursor-pointer"
                >
                  {(droneUpgrades.speedLevel || 0) >= 5 ? 'MAX TIER' : `UPGRADE ($${getDroneStatCost(droneUpgrades.speedLevel || 0)})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* FIREARMS & UPGRADES SECTION */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 flex-1">
          {/* WEAPON SELECTOR LIST */}
          <div className="flex flex-col gap-2 overflow-y-auto pr-1">
            {Object.values(WEAPON_DEFINITIONS).map((w) => {
              const unlocked = saveData.unlockedWeapons.includes(w.id);
              const active = selectedKey === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => {
                    setSelectedKey(w.id);
                    soundFx.playClick();
                  }}
                  className={`flex items-center justify-between p-3 rounded border text-left transition-all cursor-pointer ${
                    active
                      ? 'bg-red-950/40 border-red-500 text-white shadow-lg'
                      : 'bg-zinc-900/70 hover:bg-zinc-800/80 border-zinc-800 text-zinc-300'
                  }`}
                >
                  <div>
                    <div className="font-teko text-xl font-bold leading-none">{w.name}</div>
                    <div className="text-[11px] font-military text-zinc-400">{w.category}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!unlocked && (
                      <span className="flex items-center gap-1 text-xs font-mono text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800">
                        <Lock className="w-3 h-3" /> ${w.cost}
                      </span>
                    )}
                    {saveData.equippedWeapon === w.id && (
                      <span className="text-[10px] font-mono text-green-400 bg-green-950/50 px-2 py-0.5 rounded border border-green-800">
                        EQUIPPED
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* WEAPON DETAILS & UPGRADE WORKBENCH */}
          <div className="md:col-span-2 flex flex-col justify-between bg-zinc-950/80 border border-zinc-800 p-6 rounded-lg">
            <div>
              {/* Header info */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="font-mono text-xs text-red-400 tracking-wider font-semibold">
                    {selectedConfig.category.toUpperCase()}
                  </span>
                  <h3 className="font-teko text-4xl font-bold text-white leading-none">
                    {selectedConfig.name}
                  </h3>
                  <p className="font-military text-xs text-zinc-400 mt-1 max-w-lg">
                    {selectedConfig.description}
                  </p>
                </div>

                {/* Equip / Unlock Button */}
                <div>
                  {!isUnlocked ? (
                    <button
                      onClick={handleUnlock}
                      disabled={saveData.credits < selectedConfig.cost}
                      className="flex items-center gap-2 px-5 py-2 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed font-teko text-xl font-bold text-black shadow-lg active:scale-95 transition-all cursor-pointer"
                    >
                      <Lock className="w-4 h-4" />
                      UNLOCK FOR ${selectedConfig.cost}
                    </button>
                  ) : (
                    <button
                      onClick={handleEquip}
                      disabled={isEquipped}
                      className={`flex items-center gap-2 px-5 py-2 rounded font-teko text-xl font-bold shadow-lg transition-all ${
                        isEquipped
                          ? 'bg-zinc-800 text-zinc-500 cursor-default'
                          : 'bg-green-600 hover:bg-green-500 active:bg-green-700 text-white cursor-pointer active:scale-95'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      {isEquipped ? 'EQUIPPED IN LOADOUT' : 'EQUIP WEAPON'}
                    </button>
                  )}
                </div>
              </div>

              {/* STATS BENCHMARK */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 bg-zinc-900/60 p-3 rounded border border-zinc-800/80">
                <div>
                  <div className="text-[10px] font-mono text-zinc-400">BASE DAMAGE</div>
                  <div className="font-teko text-2xl font-bold text-red-400 leading-none">
                    {Math.round(selectedConfig.baseDamage * (1 + currentUpgrades.damageLevel * UPGRADE_TIERS.damageMultiplierPerLevel))} HP
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-zinc-400">MAG CAPACITY</div>
                  <div className="font-teko text-2xl font-bold text-yellow-400 leading-none">
                    {selectedConfig.baseMagSize + Math.round(selectedConfig.baseMagSize * (currentUpgrades.magLevel * UPGRADE_TIERS.magBonusPerLevel))} RNDS
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-zinc-400">FIRE RATE</div>
                  <div className="font-teko text-2xl font-bold text-blue-400 leading-none">
                    {Math.round(selectedConfig.fireRateRpm * (1 + currentUpgrades.fireRateLevel * UPGRADE_TIERS.fireRateBonusPerLevel))} RPM
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-zinc-400">RELOAD SPEED</div>
                  <div className="font-teko text-2xl font-bold text-green-400 leading-none">
                    {(selectedConfig.baseReloadTime * (1 - currentUpgrades.reloadLevel * UPGRADE_TIERS.reloadSpeedBonusPerLevel)).toFixed(2)}s
                  </div>
                </div>
              </div>

              {/* 4 UPGRADE STAT SLIDERS */}
              <div className="space-y-3 pt-2">
                {/* 1. Kinetic Damage */}
                <div className="flex items-center justify-between p-3 bg-zinc-900/80 rounded border border-zinc-800">
                  <div className="w-44">
                    <div className="text-xs font-military font-bold text-zinc-200">KINETIC DAMAGE</div>
                    <div className="text-[11px] font-mono text-red-400">
                      +{Math.round(currentUpgrades.damageLevel * UPGRADE_TIERS.damageMultiplierPerLevel * 100)}% LETHALITY
                    </div>
                  </div>

                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <div
                        key={lvl}
                        className={`h-4 w-7 rounded-xs ${
                          currentUpgrades.damageLevel >= lvl ? 'bg-red-500 shadow-sm shadow-red-500/50' : 'bg-zinc-800'
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => handleUpgrade('damageLevel')}
                    disabled={!isUnlocked || currentUpgrades.damageLevel >= 5 || saveData.credits < getUpgradeCost(currentUpgrades.damageLevel)}
                    className="px-4 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-600 font-teko text-base font-bold text-amber-400 cursor-pointer"
                  >
                    {currentUpgrades.damageLevel >= 5 ? 'MAX' : `UPGRADE ($${getUpgradeCost(currentUpgrades.damageLevel)})`}
                  </button>
                </div>

                {/* 2. Mag Capacity */}
                <div className="flex items-center justify-between p-3 bg-zinc-900/80 rounded border border-zinc-800">
                  <div className="w-44">
                    <div className="text-xs font-military font-bold text-zinc-200">MAGAZINE CAPACITY</div>
                    <div className="text-[11px] font-mono text-yellow-400">
                      {selectedConfig.baseMagSize + Math.round(selectedConfig.baseMagSize * (currentUpgrades.magLevel * UPGRADE_TIERS.magBonusPerLevel))} ROUNDS
                    </div>
                  </div>

                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <div
                        key={lvl}
                        className={`h-4 w-7 rounded-xs ${
                          currentUpgrades.magLevel >= lvl ? 'bg-yellow-500 shadow-sm shadow-yellow-500/50' : 'bg-zinc-800'
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => handleUpgrade('magLevel')}
                    disabled={!isUnlocked || currentUpgrades.magLevel >= 5 || saveData.credits < getUpgradeCost(currentUpgrades.magLevel)}
                    className="px-4 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-600 font-teko text-base font-bold text-amber-400 cursor-pointer"
                  >
                    {currentUpgrades.magLevel >= 5 ? 'MAX' : `UPGRADE ($${getUpgradeCost(currentUpgrades.magLevel)})`}
                  </button>
                </div>

                {/* 3. Fire Rate */}
                <div className="flex items-center justify-between p-3 bg-zinc-900/80 rounded border border-zinc-800">
                  <div className="w-44">
                    <div className="text-xs font-military font-bold text-zinc-200">CYCLIC FIRE RATE</div>
                    <div className="text-[11px] font-mono text-blue-400">
                      {Math.round(selectedConfig.fireRateRpm * (1 + currentUpgrades.fireRateLevel * UPGRADE_TIERS.fireRateBonusPerLevel))} RPM
                    </div>
                  </div>

                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <div
                        key={lvl}
                        className={`h-4 w-7 rounded-xs ${
                          currentUpgrades.fireRateLevel >= lvl ? 'bg-blue-500 shadow-sm shadow-blue-500/50' : 'bg-zinc-800'
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => handleUpgrade('fireRateLevel')}
                    disabled={!isUnlocked || currentUpgrades.fireRateLevel >= 5 || saveData.credits < getUpgradeCost(currentUpgrades.fireRateLevel)}
                    className="px-4 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-600 font-teko text-base font-bold text-amber-400 cursor-pointer"
                  >
                    {currentUpgrades.fireRateLevel >= 5 ? 'MAX' : `UPGRADE ($${getUpgradeCost(currentUpgrades.fireRateLevel)})`}
                  </button>
                </div>

                {/* 4. Reload Speed */}
                <div className="flex items-center justify-between p-3 bg-zinc-900/80 rounded border border-zinc-800">
                  <div className="w-44">
                    <div className="text-xs font-military font-bold text-zinc-200">TACTICAL RELOAD SPEED</div>
                    <div className="text-[11px] font-mono text-green-400">
                      {(selectedConfig.baseReloadTime * (1 - currentUpgrades.reloadLevel * UPGRADE_TIERS.reloadSpeedBonusPerLevel)).toFixed(2)}s
                    </div>
                  </div>

                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <div
                        key={lvl}
                        className={`h-4 w-7 rounded-xs ${
                          currentUpgrades.reloadLevel >= lvl ? 'bg-green-500 shadow-sm shadow-green-500/50' : 'bg-zinc-800'
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => handleUpgrade('reloadLevel')}
                    disabled={!isUnlocked || currentUpgrades.reloadLevel >= 5 || saveData.credits < getUpgradeCost(currentUpgrades.reloadLevel)}
                    className="px-4 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-600 font-teko text-base font-bold text-amber-400 cursor-pointer"
                  >
                    {currentUpgrades.reloadLevel >= 5 ? 'MAX' : `UPGRADE ($${getUpgradeCost(currentUpgrades.reloadLevel)})`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
