import type { AlertMode } from '../types';

export type SoundKind = 'longstay' | 'order';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

export async function unlockAudioEngine(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }
  return ctx.state === 'running';
}

function playTwoToneChime(kind: SoundKind) {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const tones: Record<SoundKind, [number, number]> = {
    longstay: [659.25, 523.25], // E5 -> C5 reminder chime
    order: [783.99, 1046.5], // G5 -> C6 station ping
  };

  const [f1, f2] = tones[kind];
  const now = ctx.currentTime;

  const scheduleTone = (freq: number, startOffset: number, duration: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + startOffset);

    gain.gain.setValueAtTime(0.0001, now + startOffset);
    gain.gain.exponentialRampToValueAtTime(0.22, now + startOffset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + startOffset);
    osc.stop(now + startOffset + duration + 0.02);
  };

  scheduleTone(f1, 0, 0.22);
  scheduleTone(f2, 0.19, 0.34);
}

export async function triggerTimerAlert(
  kind: SoundKind,
  spokenText: string,
  mode: AlertMode
): Promise<void> {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(kind === 'longstay' ? [120, 80, 120] : [140]);
    } catch {
      // Ignore unsupported vibration errors
    }
  }

  if (mode === 'silent') return;

  playTwoToneChime(kind);

  if (
    mode === 'chime_voice' &&
    spokenText &&
    typeof window !== 'undefined' &&
    'speechSynthesis' in window
  ) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.rate = 1.02;
      utterance.pitch = 1.04;
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 420);
    } catch {
      // Ignore speech synthesis failures
    }
  }
}
