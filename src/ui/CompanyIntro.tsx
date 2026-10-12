import React, { useEffect, useRef, useState } from 'react';

interface CompanyIntroProps {
  onComplete: () => void;
}

export const CompanyIntro: React.FC<CompanyIntroProps> = ({ onComplete }) => {
  const [opacity, setOpacity] = useState(0);
  const completedRef = useRef(false);
  // Store callback in a ref so the effect doesn't depend on it
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    // Phase 1: Fade in (starts almost immediately)
    const fadeInTimer = setTimeout(() => {
      setOpacity(1);
    }, 50);

    // Phase 2: Start fade out at 4s
    const fadeOutTimer = setTimeout(() => {
      setOpacity(0);
    }, 4000);

    // Phase 3: Complete at 5s
    const completeTimer = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current();
      }
    }, 5000);

    return () => {
      clearTimeout(fadeInTimer);
      clearTimeout(fadeOutTimer);
      clearTimeout(completeTimer);
    };
  }, []); // No dependencies — runs once on mount

  const handleSkip = () => {
    if (!completedRef.current) {
      completedRef.current = true;
      onCompleteRef.current();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center cursor-pointer select-none"
      onClick={handleSkip}
    >
      <div
        className="flex flex-col items-center gap-2 sm:gap-4 px-4"
        style={{
          opacity,
          transition: 'opacity 1s ease-in-out',
        }}
      >
        {/* Company Logo Emblem */}
        <img
          src="/assets/ui/company-logo.png"
          alt="Red Chair Games"
          className="w-40 h-40 sm:w-56 sm:h-56 md:w-64 md:h-64 object-contain drop-shadow-[0_0_40px_rgba(220,38,38,0.3)]"
          draggable={false}
        />

        {/* Company Text Logo */}
        <img
          src="/assets/ui/company-text.png"
          alt="Red Chair Games"
          className="w-64 sm:w-80 md:w-96 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]"
          draggable={false}
        />
      </div>
    </div>
  );
};
