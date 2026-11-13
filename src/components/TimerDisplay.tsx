import React, { useEffect, useState } from 'react';
import { Clock, Flame } from 'lucide-react';

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return hrs > 0
    ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
    : `${pad(mins)}:${pad(secs)}`;
}

interface TimerDisplayProps {
  seatedAt: number;
  lastCoalCheckAt?: number;
  coalAlertMinutes: number;
  longStayAlertMinutes: number;
  timeLimitMinutes?: number;
  compact?: boolean;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({
  seatedAt,
  lastCoalCheckAt,
  coalAlertMinutes,
  longStayAlertMinutes,
  timeLimitMinutes,
  compact = false,
}) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedMs = now - seatedAt;
  const elapsedMins = elapsedMs / 60_000;
  const coalElapsedMins = lastCoalCheckAt
    ? (now - lastCoalCheckAt) / 60_000
    : 0;

  const effectiveLimit = timeLimitMinutes ?? longStayAlertMinutes;
  const isOverLimit = elapsedMins >= effectiveLimit;
  const remainingMins = timeLimitMinutes
    ? Math.max(0, Math.ceil(timeLimitMinutes - elapsedMins))
    : null;
  const isExpiringSoon =
    timeLimitMinutes !== undefined &&
    !isOverLimit &&
    remainingMins !== null &&
    remainingMins <= 15;
  const isCoalDue =
    lastCoalCheckAt !== undefined && coalElapsedMins >= coalAlertMinutes;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span
        className={`inline-flex items-center gap-1.5 font-mono font-semibold tabular-nums ${
          isOverLimit
            ? 'text-fuchsia-400'
            : isExpiringSoon
            ? 'text-amber-300'
            : 'text-emerald-400'
        }`}
      >
        <Clock className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        {formatDuration(elapsedMs)}
        {timeLimitMinutes ? (
          <span className="font-sans font-medium">
            {isOverLimit
              ? `· ${Math.round(timeLimitMinutes / 60)}h limit up`
              : isExpiringSoon
              ? `· ${remainingMins}m left`
              : `· ${Math.round(timeLimitMinutes / 60)}h limit`}
          </span>
        ) : (
          isOverLimit && <span className="font-sans font-medium">· Long stay</span>
        )}
      </span>

      {isCoalDue && (
        <span className="inline-flex items-center gap-1 font-mono font-semibold text-amber-400 tabular-nums">
          <Flame className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          Coals due ({Math.floor(coalElapsedMins)}m)
        </span>
      )}
    </div>
  );
};
