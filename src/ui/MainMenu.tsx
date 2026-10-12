import React from 'react';
import { PlayerSaveData } from '../types';
import { GameLobby } from './lobby/GameLobby';

interface MainMenuProps {
  saveData: PlayerSaveData;
  onPlay: () => void;
  onOpenArsenal: () => void;
  onOpenMissions: () => void;
  onOpenSettings: () => void;
  onOpenSpecimen?: () => void;
  onOpenBuyCoins: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = (props) => {
  return <GameLobby {...props} />;
};
