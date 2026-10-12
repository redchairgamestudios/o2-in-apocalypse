import React, { useState } from 'react';
import { DollarSign, Coins, X, CheckCircle2, Sparkles, Zap, RotateCcw, ShieldCheck, Flame, Gift } from 'lucide-react';
import { PlayerSaveData } from '../types';
import { SaveManager } from '../core/SaveManager';
import { soundFx } from '../audio/SoundEffects';

interface BuyCoinsModalProps {
  saveData: PlayerSaveData;
  onClose: () => void;
  onDataChanged: () => void;
}

interface CoinTier {
  id: string;
  name: string;
  badge: string;
  tagline: string;
  coins: number;
  originalPrice: string;
  iconColor: string;
  borderColor: string;
  bgGlow: string;
  popular?: boolean;
}

const COIN_PACKAGES: CoinTier[] = [
  {
    id: 'ration',
    name: 'FIELD RATIONS SUPPLY',
    badge: 'STARTER PACK',
    tagline: 'Ammo, emergency medkits & basic sidearm enhancements.',
    coins: 1000,
    originalPrice: '$4.99',
    iconColor: 'text-amber-400',
    borderColor: 'border-amber-500/40 hover:border-amber-400',
    bgGlow: 'from-amber-950/20 to-transparent',
  },
  {
    id: 'squad',
    name: 'SQUAD RECRUIT STASH',
    badge: 'MOST POPULAR',
    tagline: 'Sufficient to immediately recruit Sgt. Vance combat ally or unlock high-caliber shotguns & SMGs.',
    coins: 5000,
    originalPrice: '$19.99',
    iconColor: 'text-sky-400',
    borderColor: 'border-sky-500/60 hover:border-sky-400 shadow-lg shadow-sky-950/40',
    bgGlow: 'from-sky-950/30 to-transparent',
    popular: true,
  },
  {
    id: 'warchest',
    name: 'BLACK OPS WARCHEST',
    badge: 'SPECIAL FORCES',
    tagline: 'Unlock the Heavy Machine Gun & Sniper Rifle, plus max out weapon lethality & turrets.',
    coins: 25000,
    originalPrice: '$49.99',
    iconColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/50 hover:border-emerald-400',
    bgGlow: 'from-emerald-950/25 to-transparent',
  },
  {
    id: 'megapack',
    name: 'COMMAND AIR-DROP OMNI-SUPPLY',
    badge: 'TEST MASTER PACK',
    tagline: 'Unlimited testing budget. Max out all 6 weapons, infinite deployable turrets & conquer Nightmare mode.',
    coins: 100000,
    originalPrice: '$99.99',
    iconColor: 'text-purple-400',
    borderColor: 'border-purple-500/60 hover:border-purple-400 shadow-xl shadow-purple-950/50',
    bgGlow: 'from-purple-950/30 to-transparent',
  },
];

export const BuyCoinsModal: React.FC<BuyCoinsModalProps> = ({
  saveData,
  onClose,
  onDataChanged,
}) => {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('15000');

  const handleClaimTier = (tier: CoinTier) => {
    soundFx.playCashEarned();
    SaveManager.addCredits(tier.coins);
    onDataChanged();
    setSuccessMessage(`REQUISITION APPROVED: +$${tier.coins.toLocaleString()} COINS ADDED TO ARSENAL!`);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3800);
  };

  const handleClaimCustom = () => {
    const parsed = parseInt(customAmount.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(parsed) && parsed > 0) {
      soundFx.playCashEarned();
      SaveManager.addCredits(parsed);
      onDataChanged();
      setSuccessMessage(`REQUISITION APPROVED: +$${parsed.toLocaleString()} COINS ADDED TO ARSENAL!`);
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3800);
    }
  };

  const handleResetCredits = () => {
    soundFx.playClick();
    SaveManager.setCredits(450);
    onDataChanged();
    setSuccessMessage('CREDITS RESET TO DEFAULT STANDARD ISSUE: $450');
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-4 sm:p-6 md:p-8 pointer-events-auto overflow-y-auto select-none touch-manipulation">
      <div className="max-w-6xl w-full mx-auto flex flex-col flex-1 pb-8">
        {/* Header Bar */}
        <div className="flex flex-wrap justify-between items-start pb-4 border-b border-zinc-800 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Coins className="w-6 h-6 text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] text-emerald-400 uppercase tracking-widest font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> FREE TESTING PROTOCOL ACTIVE
                </span>
                <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/40 short:hidden">
                  NO REAL MONEY REQUIRED
                </span>
              </div>
              <h2 className="font-teko text-2xl sm:text-4xl short:text-xl font-bold tracking-wide text-white leading-none mt-0.5">
                QUARANTINE SUPPLY REQUISITION & COIN STORE
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Live Credits Counter */}
            <div className="flex items-center gap-2 bg-zinc-950 border border-amber-500/60 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg shadow-inner">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider font-semibold leading-tight short:hidden">CURRENT BALANCE</span>
                <span className="font-teko text-xl sm:text-2xl short:text-lg font-bold text-amber-400 leading-none">
                  {saveData.credits.toLocaleString()}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
              title="Close Requisition Store"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notice Banner */}
        <div className="my-4 p-3.5 bg-gradient-to-r from-emerald-950/40 via-zinc-900/60 to-zinc-950 border border-emerald-500/40 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/30 shrink-0">
              <Gift className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="font-military text-sm font-bold text-zinc-100 flex items-center gap-2">
                TEST MODE AUTHORIZED SUPPLY GRANTS
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700/50">
                  100% FREE
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                All coin bundles are completely free for verification and testing. Claim any tier to test weapon upgrades, unlock firearms, or recruit Sgt. Vance combat ally instantly.
              </p>
            </div>
          </div>

          <button
            onClick={handleResetCredits}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded-lg text-xs font-military tracking-wider transition-colors shrink-0 cursor-pointer"
            title="Reset credits back to standard $450"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            RESET TO $450
          </button>
        </div>

        {/* Success / Transaction Alert */}
        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-950/80 border border-emerald-500 text-emerald-200 rounded-xl flex items-center gap-2.5 font-military text-sm font-bold shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* 4 Main Coin Packages Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-2">
          {COIN_PACKAGES.map((tier) => (
            <div
              key={tier.id}
              className={`relative flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-b ${tier.bgGlow} bg-zinc-950 border ${tier.borderColor} transition-all hover:scale-[1.02] shadow-lg`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-sky-500 text-black font-military text-[10px] font-extrabold px-3 py-0.5 rounded-full uppercase tracking-wider shadow-md">
                  RECOMMENDED FOR COMBAT ALLY
                </div>
              )}

              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
                    {tier.badge}
                  </span>
                  <span className="line-through font-mono text-xs text-zinc-500">
                    {tier.originalPrice}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <Coins className={`w-6 h-6 ${tier.iconColor}`} />
                  <span className="font-teko text-4xl sm:text-5xl font-bold text-white leading-none">
                    +{tier.coins.toLocaleString()}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-amber-400 font-semibold tracking-wide">
                  COINS / CREDITS
                </span>

                <h3 className="font-military text-sm font-bold text-zinc-200 mt-3 mb-1">
                  {tier.name}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed min-h-[48px]">
                  {tier.tagline}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-zinc-800/80">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-military text-zinc-400">COST:</span>
                  <span className="font-teko text-2xl font-bold text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-emerald-400" /> FREE (TEST)
                  </span>
                </div>

                <button
                  onClick={() => handleClaimTier(tier)}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:from-emerald-700 active:to-teal-700 text-white font-teko text-xl font-bold tracking-wider uppercase cursor-pointer shadow-lg shadow-emerald-950/60 transition-all flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  CLAIM {tier.coins.toLocaleString()} COINS
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Custom Coin Amount Requisition Panel */}
        <div className="mt-4 p-5 bg-zinc-950 border border-zinc-800 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <h4 className="font-military text-sm font-bold text-white uppercase tracking-wider">
                CUSTOM REQUISITION GRANT
              </h4>
              <span className="text-[10px] font-mono bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                FREE TEST INPUT
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Need a specific test amount? Type any coin value below to immediately grant it to your profile.
            </p>

            <div className="flex flex-wrap gap-2 mt-3">
              {[2000, 10000, 50000, 200000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setCustomAmount(amt.toString())}
                  className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 rounded text-xs font-mono font-semibold cursor-pointer transition-colors"
                >
                  +{amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-48">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
              <input
                type="number"
                min="1"
                max="10000000"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="Amount"
                className="w-full pl-9 pr-3 py-2 bg-black border border-zinc-700 focus:border-amber-400 focus:outline-none rounded-xl text-white font-mono text-sm"
              />
            </div>

            <button
              onClick={handleClaimCustom}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-teko text-xl font-bold tracking-wider uppercase rounded-xl cursor-pointer shadow-lg shadow-amber-950/40 transition-colors shrink-0 flex items-center gap-1.5"
            >
              <Coins className="w-4 h-4" />
              CLAIM CUSTOM
            </button>
          </div>
        </div>

        {/* Quick Footer Instructions */}
        <div className="mt-4 text-center text-xs font-military text-zinc-400">
          Coins persist across sessions via local save storage. Use them anytime in the Military Arsenal or mid-mission tactical support.
        </div>
      </div>
    </div>
  );
};
