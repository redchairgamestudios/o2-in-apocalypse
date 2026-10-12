import React, { useState } from 'react';
import { TopBar } from './TopBar';
import { LeftNavigation, NavItemId } from './LeftNavigation';
import { BottomStatusBar } from './BottomStatusBar';
import { PlayerSaveData } from '../../types';
import '../../styles/tactical.css';

interface GameLobbyProps {
  saveData: PlayerSaveData;
  onPlay: () => void;
  onOpenArsenal: () => void;
  onOpenMissions: () => void;
  onOpenSettings: () => void;
  onOpenSpecimen?: () => void;
  onOpenBuyCoins: () => void;
}

export const GameLobby: React.FC<GameLobbyProps> = ({
  saveData,
  onPlay,
  onOpenArsenal,
  onOpenMissions,
  onOpenSettings,
  onOpenSpecimen,
  onOpenBuyCoins,
}) => {
  const [selectedNav, setSelectedNav] = useState<NavItemId>('campaign');

  const handleNavSelect = (id: NavItemId) => {
    setSelectedNav(id);

    // Trigger the corresponding action when clicking a non-campaign item
    switch (id) {
      case 'arsenal':
        onOpenArsenal();
        break;
      case 'squad':
        // Opens the drone/squad section — currently goes to arsenal with drone tab
        // For now, use specimen or a custom handler
        break;
      case 'specimen':
        onOpenSpecimen?.();
        break;
      case 'store':
        onOpenBuyCoins();
        break;
      case 'settings':
        onOpenSettings();
        break;
      case 'campaign':
        // Show the full campaign mission selector
        onOpenMissions();
        break;
    }
  };

  const handleDeploy = () => {
    onPlay();
  };

  return (
    <div className="absolute inset-0 z-30 overflow-hidden pointer-events-auto select-none">
      {/* Background Image */}
      <div
        className="lobby-bg"
        style={{
          backgroundImage: 'url(/assets/ui/lobby-bg.png)',
        }}
      />

      {/* Dark overlay for readability */}
      <div className="fixed inset-0 z-[1] bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
      <div className="fixed inset-0 z-[1] bg-gradient-to-t from-black/60 via-transparent to-black/40" />

      {/* HUD Effects */}
      <div className="scanline-overlay" />
      <div className="film-grain" />
      <div className="lobby-vignette" />

      {/* Main Layout */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Top Bar */}
        <TopBar credits={saveData.credits} />

        {/* Middle Content */}
        <div className="flex-1 flex items-center overflow-hidden">
          {/* Left Navigation Panel */}
          <LeftNavigation
            selectedId={selectedNav}
            onSelect={handleNavSelect}
            onDeploy={handleDeploy}
          />

          {/* Right side is the background image showing through */}
        </div>

        {/* Bottom Status Bar */}
        <BottomStatusBar />
      </div>

      {/* Corner Brackets - top-left */}
      <div className="fixed top-2 left-2 w-6 h-6 z-[95] pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-[#FF1717]/40" />
        <div className="absolute top-0 left-0 h-full w-[2px] bg-[#FF1717]/40" />
      </div>

      {/* Corner Brackets - top-right */}
      <div className="fixed top-2 right-2 w-6 h-6 z-[95] pointer-events-none">
        <div className="absolute top-0 right-0 w-full h-[2px] bg-[#FF1717]/40" />
        <div className="absolute top-0 right-0 h-full w-[2px] bg-[#FF1717]/40" />
      </div>

      {/* Corner Brackets - bottom-left */}
      <div className="fixed bottom-2 left-2 w-6 h-6 z-[95] pointer-events-none">
        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#FF1717]/40" />
        <div className="absolute bottom-0 left-0 h-full w-[2px] bg-[#FF1717]/40" />
      </div>

      {/* Corner Brackets - bottom-right */}
      <div className="fixed bottom-2 right-2 w-6 h-6 z-[95] pointer-events-none">
        <div className="absolute bottom-0 right-0 w-full h-[2px] bg-[#FF1717]/40" />
        <div className="absolute bottom-0 right-0 h-full w-[2px] bg-[#FF1717]/40" />
      </div>
    </div>
  );
};
