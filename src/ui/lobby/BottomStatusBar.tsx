import React, { useEffect, useState } from 'react';

export const BottomStatusBar: React.FC = () => {
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
      const h12 = now.getHours() % 12 || 12;
      setTime(`${h12.toString().padStart(2, '0')}:${minutes} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative z-20 w-full bg-[#050607]/85 border-t border-[#73787C]/20 backdrop-blur-sm">
      <div className="flex items-center justify-between safe-px py-2 sm:py-2.5 short:py-1 gap-3 sm:gap-6">
        {/* LEFT: Radar + Status Items */}
        <div className="flex items-center gap-3 sm:gap-5 overflow-hidden">
          {/* Radar */}
          <div className="radar-container shrink-0 hidden sm:block">
            <div className="radar-grid" />
            <div className="radar-ring radar-ring-1" />
            <div className="radar-ring radar-ring-2" />
            <div className="radar-sweep" />
            <div className="radar-center" />
            {/* Enemy dots */}
            <div className="radar-dot" style={{ top: '25%', left: '65%' }} />
            <div className="radar-dot" style={{ top: '60%', left: '30%' }} />
            <div className="radar-dot" style={{ top: '40%', left: '75%' }} />
            <div className="radar-dot" style={{ top: '70%', left: '55%' }} />
          </div>

          {/* System Status */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-[9px] sm:text-[10px] text-[#73787C] tracking-wider uppercase">
              SYSTEM STATUS:
            </span>
            <span className="font-mono text-[9px] sm:text-[10px] text-[#70E35C] font-bold tracking-wider uppercase status-pulse">
              OPERATIONAL
            </span>
            <span className="w-2 h-2 rounded-full bg-[#70E35C] shadow-[0_0_6px_rgba(112,227,92,0.6)]" />
          </div>

          {/* Separator */}
          <div className="w-px h-4 bg-[#73787C]/20 hidden sm:block" />

          {/* Radar Online */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <span className="font-mono text-[9px] sm:text-[10px] text-[#73787C] tracking-wider uppercase">
              RADAR ONLINE
            </span>
            <span className="w-2 h-2 rounded-full bg-[#70E35C] shadow-[0_0_6px_rgba(112,227,92,0.6)]" />
          </div>

          {/* Separator */}
          <div className="w-px h-4 bg-[#73787C]/20 hidden md:block" />

          {/* Horde Threat Level */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <span className="font-mono text-[9px] sm:text-[10px] text-[#73787C] tracking-wider uppercase">
              HORDE THREAT LEVEL:
            </span>
            <span className="font-mono text-[9px] sm:text-[10px] text-[#FF1717] font-bold tracking-wider uppercase blink-slow">
              CRITICAL
            </span>
            <span className="w-2 h-2 rounded-full bg-[#FF1717] shadow-[0_0_6px_rgba(255,23,23,0.6)] blink-slow" />
          </div>
        </div>

        {/* RIGHT: Local Time + Signal */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] sm:text-[10px] text-[#73787C] tracking-wider uppercase">
              LOCAL TIME:
            </span>
            <span className="font-mono text-[10px] sm:text-xs text-[#E8E8E8] font-bold tracking-wider">
              {time}
            </span>
          </div>

          {/* Signal Strength */}
          <div className="flex items-end gap-[2px] h-4">
            <span className="signal-bar" style={{ height: '4px' }} />
            <span className="signal-bar" style={{ height: '7px' }} />
            <span className="signal-bar" style={{ height: '10px' }} />
            <span className="signal-bar" style={{ height: '13px' }} />
            <span className="signal-bar" style={{ height: '16px' }} />
          </div>
        </div>
      </div>
    </div>
  );
};
