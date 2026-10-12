import React, { useEffect, useRef } from 'react';
import { PlayerInput } from '../player/PlayerController';

interface MobileControlsProps {
  inputRef: React.MutableRefObject<PlayerInput>;
  touchSensitivity: number;
}

export const MobileControls: React.FC<MobileControlsProps> = ({ inputRef, touchSensitivity }) => {
  const joystickBaseRef = useRef<HTMLDivElement | null>(null);
  const joystickKnobRef = useRef<HTMLDivElement | null>(null);
  const touchAreaRef = useRef<HTMLDivElement | null>(null);

  const moveTouchId = useRef<number | null>(null);
  const lookTouchId = useRef<number | null>(null);

  const joystickCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastLookPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const target = touch.target as HTMLElement | null;
        const pointEl = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;

        // Never intercept buttons, inputs, links, or shoot controls
        if (
          target?.closest('button') ||
          target?.closest('input') ||
          target?.closest('select') ||
          target?.closest('a') ||
          target?.closest('#mobile-shoot-btn') ||
          pointEl?.closest('button') ||
          pointEl?.closest('#mobile-shoot-btn')
        ) {
          continue;
        }

        // Left 48% of screen = Movement Joystick
        if (touch.clientX < screenWidth * 0.48 && moveTouchId.current === null) {
          moveTouchId.current = touch.identifier;

          const defaultBase = joystickBaseRef.current?.getBoundingClientRect();
          let cx = touch.clientX;
          let cy = touch.clientY;

          // If touched near the default visible joystick area, use that center for stability
          if (defaultBase && Math.hypot(touch.clientX - (defaultBase.left + defaultBase.width / 2), touch.clientY - (defaultBase.top + defaultBase.height / 2)) < 65) {
            cx = defaultBase.left + defaultBase.width / 2;
            cy = defaultBase.top + defaultBase.height / 2;
          }

          joystickCenter.current = { x: cx, y: cy };

          if (joystickBaseRef.current && joystickKnobRef.current) {
            joystickBaseRef.current.style.opacity = '0.9';
            joystickBaseRef.current.style.left = `${cx - 56}px`;
            joystickBaseRef.current.style.top = `${cy - 56}px`;
            joystickBaseRef.current.style.bottom = 'auto';
            joystickKnobRef.current.style.transform = 'translate(0px, 0px)';
          }
        }
        // Right half = Look & Camera drag (ignore top 12% where HUD lives)
        else if (touch.clientX >= screenWidth * 0.48 && touch.clientY > screenHeight * 0.12 && lookTouchId.current === null) {
          lookTouchId.current = touch.identifier;
          lastLookPos.current = { x: touch.clientX, y: touch.clientY };
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        // Process Move Joystick
        if (touch.identifier === moveTouchId.current) {
          const dx = touch.clientX - joystickCenter.current.x;
          const dy = touch.clientY - joystickCenter.current.y;
          const maxDist = 48;
          const dist = Math.hypot(dx, dy);
          const angle = Math.atan2(dy, dx);
          const clampedDist = Math.min(dist, maxDist);

          const knobX = Math.cos(angle) * clampedDist;
          const knobY = Math.sin(angle) * clampedDist;

          if (joystickKnobRef.current) {
            joystickKnobRef.current.style.transform = `translate(${knobX}px, ${knobY}px)`;
          }

          // Normalized input with deadzone
          const normDist = clampedDist / maxDist;
          if (normDist > 0.08) {
            const remapped = (normDist - 0.08) / (1.0 - 0.08);
            inputRef.current.strafe = Math.cos(angle) * remapped;
            const forward = -Math.sin(angle) * remapped;
            inputRef.current.forward = forward;

            // Fluid Auto-Sprint when pushed forward past 68%
            if (forward > 0.68) {
              inputRef.current.sprint = true;
              if (joystickKnobRef.current) {
                joystickKnobRef.current.style.borderColor = '#fbbf24';
              }
            } else {
              inputRef.current.sprint = false;
              if (joystickKnobRef.current) {
                joystickKnobRef.current.style.borderColor = 'rgba(52, 211, 153, 0.8)';
              }
            }
          } else {
            inputRef.current.strafe = 0;
            inputRef.current.forward = 0;
            inputRef.current.sprint = false;
          }
        }

        // Process Camera Look Drag
        if (touch.identifier === lookTouchId.current) {
          const dx = touch.clientX - lastLookPos.current.x;
          const dy = touch.clientY - lastLookPos.current.y;

          inputRef.current.lookDeltaX += dx * 0.0035 * touchSensitivity;
          inputRef.current.lookDeltaY += -dy * 0.0035 * touchSensitivity;

          lastLookPos.current = { x: touch.clientX, y: touch.clientY };
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        if (touch.identifier === moveTouchId.current) {
          moveTouchId.current = null;
          inputRef.current.forward = 0;
          inputRef.current.strafe = 0;
          inputRef.current.sprint = false;

          if (joystickKnobRef.current) {
            joystickKnobRef.current.style.transform = 'translate(0px, 0px)';
            joystickKnobRef.current.style.borderColor = 'rgba(52, 211, 153, 0.8)';
          }
          if (joystickBaseRef.current) {
            joystickBaseRef.current.style.opacity = '0.45';
            joystickBaseRef.current.style.left = 'calc(28px + env(safe-area-inset-left))';
            joystickBaseRef.current.style.top = 'auto';
            joystickBaseRef.current.style.bottom = 'calc(28px + env(safe-area-inset-bottom))';
          }
        }

        if (touch.identifier === lookTouchId.current) {
          lookTouchId.current = null;
        }
      }
    };

    // Dedicated shoot button touch handling with active prevention
    const shootBtn = document.getElementById('mobile-shoot-btn');
    const onShootStart = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      inputRef.current.shoot = true;
    };
    const onShootEnd = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      inputRef.current.shoot = false;
    };

    if (shootBtn) {
      shootBtn.addEventListener('touchstart', onShootStart, { passive: false });
      shootBtn.addEventListener('touchend', onShootEnd, { passive: false });
      shootBtn.addEventListener('touchcancel', onShootEnd, { passive: false });
    }

    // Touch events on window with passive: false for movement zone
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      if (shootBtn) {
        shootBtn.removeEventListener('touchstart', onShootStart);
        shootBtn.removeEventListener('touchend', onShootEnd);
        shootBtn.removeEventListener('touchcancel', onShootEnd);
      }
    };
  }, [inputRef, touchSensitivity]);

  return (
    <div
      ref={touchAreaRef}
      className="absolute inset-0 pointer-events-none z-10 select-none overflow-hidden"
      style={{ touchAction: 'none' }}
    >
      {/* Minimal Tactical Virtual Joystick Base (Resting bottom-left, notch-safe) */}
      <div
        ref={joystickBaseRef}
        className="absolute left-[max(env(safe-area-inset-left),28px)] bottom-[max(env(safe-area-inset-bottom),28px)] w-28 h-28 rounded-full border border-emerald-500/30 bg-black/40 backdrop-blur-xs flex items-center justify-center pointer-events-none transition-opacity duration-200 shadow-lg shadow-black/60"
        style={{ opacity: 0.5 }}
      >
        {/* Subtle Cardinal Guides */}
        <div className="absolute top-1 w-1 h-2 bg-emerald-400/50 rounded-full" />
        <div className="absolute bottom-1 w-1 h-2 bg-emerald-400/50 rounded-full" />
        <div className="absolute left-1 h-1 w-2 bg-emerald-400/50 rounded-full" />
        <div className="absolute right-1 h-1 w-2 bg-emerald-400/50 rounded-full" />
        <div className="absolute inset-3 rounded-full border border-emerald-500/15" />

        {/* Dynamic Analog Thumb Knob */}
        <div
          ref={joystickKnobRef}
          className="w-12 h-12 rounded-full bg-gradient-to-b from-zinc-800/90 to-zinc-950/90 border border-emerald-400/70 shadow-md shadow-emerald-950/40 flex items-center justify-center transition-transform duration-75"
        >
          <div className="w-3 h-3 rounded-full bg-emerald-400/80 shadow-xs shadow-emerald-300" />
        </div>
      </div>
    </div>
  );
};
