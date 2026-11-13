import { useCallback, useEffect, useRef, useState } from 'react';

const WAKE_LOCK_STORAGE_KEY = 'sinos_android_wakelock_v1';

export function triggerHaptic(durationMs = 12): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(durationMs);
    }
  } catch {
    // Ignore unsupported vibration environments
  }
}

export function useAndroidWakeLock() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(WAKE_LOCK_STORAGE_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [active, setActive] = useState(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  const supported =
    typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  const acquire = useCallback(async () => {
    if (!supported || !enabled || document.visibilityState !== 'visible') {
      return;
    }
    try {
      if (sentinelRef.current && !sentinelRef.current.released) {
        setActive(true);
        return;
      }
      const sentinel = await navigator.wakeLock.request('screen');
      sentinelRef.current = sentinel;
      setActive(true);
      sentinel.addEventListener('release', () => {
        setActive(false);
      });
    } catch {
      setActive(false);
    }
  }, [enabled, supported]);

  const release = useCallback(async () => {
    try {
      if (sentinelRef.current && !sentinelRef.current.released) {
        await sentinelRef.current.release();
      }
    } catch {
      // Ignore release failure
    } finally {
      sentinelRef.current = null;
      setActive(false);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(WAKE_LOCK_STORAGE_KEY, String(enabled));
    } catch {
      // Ignore storage errors
    }

    if (enabled) {
      acquire();
    } else {
      release();
    }
  }, [enabled, acquire, release]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        acquire();
      }
    };
    const onFirstGesture = () => {
      if (enabled) {
        acquire();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pointerdown', onFirstGesture, { once: true });
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pointerdown', onFirstGesture);
    };
  }, [enabled, acquire]);

  return {
    supported,
    enabled,
    active,
    setEnabled,
  };
}
