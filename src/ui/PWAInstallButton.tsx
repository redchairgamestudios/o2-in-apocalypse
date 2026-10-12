import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share2, X, Smartphone } from 'lucide-react';

export const PWAInstallButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Suppress if already running in standalone PWA mode
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`flex items-center gap-1.5 bg-gradient-to-r from-red-700 to-rose-800 hover:from-red-600 hover:to-rose-700 active:from-red-800 active:to-rose-900 text-white px-3 py-1.5 rounded-lg font-teko text-base sm:text-lg font-bold tracking-wider uppercase cursor-pointer shadow-lg shadow-red-950/60 transition-all border border-red-500/60 touch-manipulation ${className}`}
        title="Install O² in Apocalypse to your home screen or desktop"
      >
        <Download className="w-4 h-4 text-red-200" />
        <span>INSTALL APP</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 text-zinc-200 px-3 py-1.5 rounded-lg font-teko text-base sm:text-lg font-bold tracking-wider uppercase cursor-pointer border border-zinc-700 touch-manipulation ${className}`}
          title="Install on iOS"
        >
          <Smartphone className="w-4 h-4 text-red-400" />
          <span>INSTALL ON IOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl relative text-left">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <img
                  src="/app-logo.png"
                  alt="O² in Apocalypse Logo"
                  className="w-12 h-12 rounded-xl border border-red-500/40 object-contain bg-black shadow-md"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h3 className="text-xl font-bold font-teko tracking-wide text-white leading-tight">
                    INSTALL O² IN APOCALYPSE
                  </h3>
                  <p className="text-xs text-zinc-400 font-mono">Progressive Web App</p>
                </div>
              </div>

              <div className="space-y-3 font-military text-sm text-zinc-300">
                <div className="flex items-start gap-2.5 bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800">
                  <Share2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <span>1. Tap the <strong className="text-white">Share</strong> icon in the Safari navigation bar.</span>
                </div>
                <div className="flex items-start gap-2.5 bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800">
                  <Download className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  <span>2. Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.</span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-teko text-lg font-bold tracking-wider uppercase transition cursor-pointer"
              >
                GOT IT
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
