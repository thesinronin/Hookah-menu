import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 md:bottom-4 left-4 right-4 sm:right-auto z-50 flex items-center gap-2 rounded-xl border border-amber-400/50 bg-[#1B1307]/95 px-3.5 py-2.5 text-xs font-semibold text-amber-200 shadow-lg backdrop-blur-md"
    >
      <WifiOff className="h-4 w-4 shrink-0 text-amber-400" />
      <span>Offline Mode — Cached interface active, live table sync paused.</span>
    </div>
  );
};
