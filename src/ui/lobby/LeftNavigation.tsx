import React from 'react';
import {
  Crosshair, Wrench, Radar, Skull, Gift, Settings,
  ChevronRight, Biohazard, Target, Users
} from 'lucide-react';

type NavItemId = 'campaign' | 'arsenal' | 'squad' | 'specimen' | 'store' | 'settings';

interface NavItem {
  id: NavItemId;
  title: string;
  subtitle: string;
  subtitle2?: string;
  accent: string;
  accentBorder: string;
  accentBg: string;
  accentText: string;
  glowClass: string;
  icon: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const menuItems: NavItem[] = [
  {
    id: 'campaign',
    title: 'CAMPAIGN OPERATIONS',
    subtitle: 'MISSION 06: INDUSTRIAL DEPOT',
    accent: '#FF1717',
    accentBorder: 'border-[#FF1717]',
    accentBg: 'bg-[#FF1717]/10',
    accentText: 'text-[#FF1717]',
    glowClass: 'glow-red',
    icon: <Crosshair className="w-6 h-6 text-[#FF1717]" />,
    rightIcon: (
      <div className="flex items-center gap-0.5 chevron-animate">
        <ChevronRight className="w-4 h-4 text-[#FF1717]" />
        <ChevronRight className="w-4 h-4 text-[#FF1717] -ml-2.5" />
        <ChevronRight className="w-4 h-4 text-[#FF1717] -ml-2.5" />
      </div>
    ),
  },
  {
    id: 'arsenal',
    title: 'ARSENAL & WEAPONRY',
    subtitle: '8/8 WEAPONS',
    accent: '#FF9D18',
    accentBorder: 'border-[#FF9D18]',
    accentBg: 'bg-[#FF9D18]/10',
    accentText: 'text-[#FF9D18]',
    glowClass: 'glow-orange',
    icon: <Wrench className="w-6 h-6 text-[#FF9D18]" />,
    rightIcon: <Target className="w-5 h-5 text-[#FF9D18]/60" />,
  },
  {
    id: 'squad',
    title: 'SQUAD RECON &',
    subtitle: 'DRONE HANGAR',
    subtitle2: 'UAV DRONE: READY  •  SQUAD ALLIES: 3 DEPLOYED',
    accent: '#26D9FF',
    accentBorder: 'border-[#26D9FF]',
    accentBg: 'bg-[#26D9FF]/10',
    accentText: 'text-[#26D9FF]',
    glowClass: 'glow-cyan',
    icon: <Radar className="w-6 h-6 text-[#26D9FF]" />,
    rightIcon: <Users className="w-5 h-5 text-[#26D9FF]/60" />,
  },
  {
    id: 'specimen',
    title: 'SPECIMEN LAB',
    subtitle: 'VIEW & RESEARCH MUTATIONS',
    accent: '#70E35C',
    accentBorder: 'border-[#70E35C]',
    accentBg: 'bg-[#70E35C]/10',
    accentText: 'text-[#70E35C]',
    glowClass: 'glow-green',
    icon: <Biohazard className="w-6 h-6 text-[#70E35C]" />,
    rightIcon: <Skull className="w-5 h-5 text-[#70E35C]/60" />,
  },
  {
    id: 'store',
    title: 'FREE REQUISITION STORE',
    subtitle: 'CLAIM FREE SUPPLIES & CREDITS',
    accent: '#F5B83D',
    accentBorder: 'border-[#F5B83D]',
    accentBg: 'bg-[#F5B83D]/10',
    accentText: 'text-[#F5B83D]',
    glowClass: 'glow-gold',
    icon: <Gift className="w-6 h-6 text-[#F5B83D]" />,
    rightIcon: <span className="w-3 h-3 rounded-full bg-[#FF1717] blink-slow inline-block" />,
  },
  {
    id: 'settings',
    title: 'SETTINGS & CONTROLS',
    subtitle: 'AUDIO • VIDEO • GAMEPLAY • KEYBINDS',
    accent: '#73787C',
    accentBorder: 'border-[#73787C]',
    accentBg: 'bg-[#73787C]/10',
    accentText: 'text-[#73787C]',
    glowClass: '',
    icon: <Settings className="w-6 h-6 text-[#73787C]" />,
    rightIcon: <Settings className="w-4 h-4 text-[#73787C]/40" />,
  },
];

interface LeftNavigationProps {
  selectedId: NavItemId;
  onSelect: (id: NavItemId) => void;
  onDeploy: () => void;
}

export type { NavItemId };

export const LeftNavigation: React.FC<LeftNavigationProps> = ({ selectedId, onSelect, onDeploy }) => {
  return (
    <div className="relative z-20 flex flex-col gap-1.5 sm:gap-2 w-full max-w-[440px] lg:max-w-[480px] px-3 sm:px-5 py-2 sm:py-3
      short:grid short:grid-cols-2 short:gap-1.5 short:max-w-[680px] short:px-4 short:py-2 short:content-center
      min-[768px]:short:grid-cols-3 min-[768px]:short:max-w-[980px]">
      {menuItems.map((item) => {
        const isSelected = selectedId === item.id;

        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`
              nav-card group cursor-pointer w-full
              flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-sm
              short:gap-2 short:px-2.5 short:py-1.5
              border backdrop-blur-sm
              ${isSelected
                ? `${item.accentBorder} ${item.accentBg} ${item.glowClass} nav-card-selected`
                : 'border-[#73787C]/20 bg-[#0A0D0F]/70 hover:bg-[#111518]/80 hover:border-[#73787C]/40'
              }
              transition-all duration-200 text-left
            `}
          >
            {/* Left Icon Box */}
            <div
              className={`
                w-10 h-10 sm:w-12 sm:h-12 rounded flex items-center justify-center shrink-0
                short:w-8 short:h-8 [&>svg]:short:w-4 [&>svg]:short:h-4
                border
                ${isSelected
                  ? `${item.accentBorder} ${item.accentBg}`
                  : 'border-[#73787C]/20 bg-[#111518]/80'
                }
              `}
            >
              {item.icon}
            </div>

            {/* Title & Subtitle */}
            <div className="flex-1 min-w-0">
              <div className={`font-rajdhani text-sm sm:text-base short:text-xs min-[768px]:short:text-[13px] font-bold tracking-wide leading-tight ${isSelected ? 'text-[#E8E8E8]' : 'text-[#E8E8E8]/80 group-hover:text-[#E8E8E8]'}`}>
                {item.title}
                {item.id === 'squad' && (
                  <span className="block">{item.subtitle}</span>
                )}
              </div>
              <div className={`font-mono text-[9px] sm:text-[10px] short:text-[8px] tracking-wider mt-0.5 short:mt-0 truncate ${isSelected ? item.accentText : 'text-[#73787C] group-hover:text-[#73787C]/80'}`}>
                {item.id === 'squad' ? item.subtitle2 : item.subtitle}
              </div>
            </div>

            {/* Right Icon / Indicator */}
            <div className="shrink-0 [&>svg]:short:hidden short:[&>span]:w-2 short:[&>span]:h-2">
              {item.rightIcon}
            </div>
          </button>
        );
      })}

      {/* DEPLOY Button - shows when campaign is selected */}
      {selectedId === 'campaign' && (
        <button
          onClick={onDeploy}
          className="deploy-btn mt-2 w-full bg-gradient-to-r from-[#C91010] to-[#8E0808] hover:from-[#FF1717] hover:to-[#C91010] border-2 border-[#FF1717] text-white px-5 py-3 sm:py-3.5 short:col-span-full short:mt-0.5 short:py-2 rounded-sm font-oswald text-xl sm:text-2xl short:text-lg font-bold tracking-[0.15em] uppercase cursor-pointer"
        >
          <div className="flex items-center justify-center gap-3">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            DEPLOY
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          </div>
        </button>
      )}
    </div>
  );
};
