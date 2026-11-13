import React, { useEffect, useState } from 'react';
import { Delete, Lock, X } from 'lucide-react';

interface PinPromptModalProps {
  visible: boolean;
  expectedPin: string;
  actionLabel: string;
  onSuccess: () => void;
  onClose: () => void;
}

export const PinPromptModal: React.FC<PinPromptModalProps> = ({
  visible,
  expectedPin,
  actionLabel,
  onSuccess,
  onClose,
}) => {
  const [entered, setEntered] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (visible) {
      setEntered('');
      setErrorMsg('');
    }
  }, [visible, actionLabel]);

  if (!visible) return null;

  const targetLen = Math.max(4, expectedPin.length);

  const handleDigit = (digit: string) => {
    if (entered.length >= 6) return;
    const next = entered + digit;
    setErrorMsg('');
    if (next === expectedPin) {
      setEntered('');
      onSuccess();
      return;
    }
    if (next.length >= targetLen) {
      setErrorMsg('Incorrect Manager PIN');
      setEntered('');
      return;
    }
    setEntered(next);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xs rounded-t-3xl sm:rounded-2xl border border-fuchsia-500/40 bg-[#0A0F1C] p-5 shadow-[0_0_40px_rgba(217,70,239,0.22)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-fuchsia-400" />
            <h2 className="text-base font-bold text-slate-100 font-display tracking-wide">
              Manager PIN Required
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-slate-400 hover:bg-cyan-500/10 hover:text-cyan-200"
            aria-label="Cancel PIN entry"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 text-center text-xs text-slate-300">
          Enter PIN to <strong className="text-cyan-200">{actionLabel}</strong>
        </p>

        {/* PIN Dots */}
        <div className="mt-4 flex justify-center gap-3">
          {Array.from({ length: targetLen }, (_, idx) => {
            const filled = idx < entered.length;
            return (
              <span
                key={idx}
                className={`h-3.5 w-3.5 rounded-full border transition-colors ${
                  filled
                    ? 'border-cyan-300 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]'
                    : 'border-cyan-500/40 bg-[#060913]'
                }`}
              />
            );
          })}
        </div>

        {errorMsg && (
          <p className="mt-2.5 text-center text-xs font-semibold text-fuchsia-300">
            {errorMsg}
          </p>
        )}

        {/* Touch Keypad */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="min-h-[52px] rounded-xl border border-cyan-500/25 bg-[#060913] font-mono text-lg font-bold text-slate-100 transition-colors hover:border-cyan-400 hover:bg-cyan-500/10 active:scale-95"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setEntered('');
              setErrorMsg('');
            }}
            className="min-h-[52px] rounded-xl border border-cyan-500/20 bg-[#060913] text-xs font-semibold text-slate-400 hover:text-slate-200"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="min-h-[52px] rounded-xl border border-cyan-500/25 bg-[#060913] font-mono text-lg font-bold text-slate-100 transition-colors hover:border-cyan-400 hover:bg-cyan-500/10 active:scale-95"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => setEntered((prev) => prev.slice(0, -1))}
            aria-label="Backspace"
            className="flex min-h-[52px] items-center justify-center rounded-xl border border-cyan-500/20 bg-[#060913] text-slate-300 hover:border-cyan-400/50"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
