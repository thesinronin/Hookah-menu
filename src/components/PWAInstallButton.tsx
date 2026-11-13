import React, { useState } from 'react';
import { Check, Copy, Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handlePrimaryClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard denial
    }
  };

  return (
    <>
      {variant === 'card' ? (
        <button
          type="button"
          onClick={handlePrimaryClick}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/50 bg-cyan-400/15 px-4 py-2.5 text-xs font-bold text-cyan-200 transition-colors hover:bg-cyan-400/25 cyber-glow-cyan"
        >
          {isInstallable ? (
            <>
              <Download className="h-4 w-4 text-cyan-300" />
              Install Android App
            </>
          ) : (
            <>
              <Smartphone className="h-4 w-4 text-cyan-300" />
              {isIOS ? 'Install App on Device' : 'Install on Android Phone / Tablet'}
            </>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={handlePrimaryClick}
          className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
            isInstallable
              ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300 cyber-glow-cyan'
              : 'border border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200 hover:border-fuchsia-400 hover:bg-fuchsia-500/20'
          }`}
        >
          {isInstallable ? (
            <>
              <Download className="h-3.5 w-3.5" />
              <span>Install App</span>
            </>
          ) : (
            <>
              <Smartphone className="h-3.5 w-3.5 text-fuchsia-400" />
              <span className="hidden sm:inline">Android App</span>
              <span className="sm:hidden">Install</span>
            </>
          )}
        </button>
      )}

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-cyan-500/35 bg-[#0A0F1C] p-5 shadow-[0_0_40px_rgba(6,182,212,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-cyan-500/40 sm:hidden" />

            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-cyan-400" />
                <h2 className="text-lg font-bold text-slate-100 font-display tracking-wide">
                  {isIOS ? 'Install on iPhone / iPad' : 'Install SIN-OS on Android'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:bg-cyan-500/10 hover:text-cyan-200"
                aria-label="Close install guide"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-slate-300">
              {isIOS ? (
                <ol className="space-y-2.5 rounded-xl border border-cyan-500/20 bg-[#060913] p-4 list-decimal list-inside">
                  <li>
                    Open this app URL in <strong className="text-cyan-200">Safari</strong>.
                  </li>
                  <li>
                    Tap the <strong className="text-cyan-200">Share</strong> button in Safari&apos;s toolbar.
                  </li>
                  <li>
                    Scroll down and tap <strong className="text-cyan-200">Add to Home Screen</strong>.
                  </li>
                </ol>
              ) : (
                <ol className="space-y-2.5 rounded-xl border border-cyan-500/20 bg-[#060913] p-4 list-decimal list-inside">
                  <li>
                    Open the app directly in <strong className="text-cyan-200">Google Chrome</strong> on your Android phone or tablet.
                  </li>
                  <li>
                    Tap the <strong className="text-cyan-200">⋮ Menu</strong> icon in the top-right corner of Chrome.
                  </li>
                  <li>
                    Tap <strong className="text-cyan-200">Install app</strong> (or <strong className="text-cyan-200">Add to Home screen</strong>) to launch SIN-OS full-screen like a native Android app.
                  </li>
                </ol>
              )}

              <button
                type="button"
                onClick={handleCopyUrl}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-[#060913] px-4 py-2.5 text-xs font-semibold text-cyan-200 hover:border-cyan-400"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-400" />
                    URL Copied for Android Chrome
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 text-cyan-400" />
                    Copy App URL for Android Chrome
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="min-h-[44px] w-full rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
