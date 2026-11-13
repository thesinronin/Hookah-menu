import React, { useState } from 'react';
import { CheckCircle2, Plus, Sparkles, Trash2, X, XCircle } from 'lucide-react';
import type { FlavorOption } from '../types';

interface FlavorManagerModalProps {
  visible: boolean;
  flavors: FlavorOption[];
  onClose: () => void;
  onAddFlavor: (name: string) => void;
  onToggleAvailability: (flavorId: string) => void;
  onRemoveFlavor: (flavorId: string) => void;
}

export const FlavorManagerModal: React.FC<FlavorManagerModalProps> = ({
  visible,
  flavors,
  onClose,
  onAddFlavor,
  onToggleAvailability,
  onRemoveFlavor,
}) => {
  const [newFlavorName, setNewFlavorName] = useState('');

  if (!visible) return null;

  const availableCount = flavors.filter((f) => f.available).length;
  const soldOutCount = flavors.length - availableCount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFlavorName.trim();
    if (!trimmed) return;
    onAddFlavor(trimmed);
    setNewFlavorName('');
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full sm:max-w-lg flex-col rounded-t-3xl sm:rounded-2xl border border-fuchsia-500/35 bg-[#0A0F1C] p-5 shadow-[0_0_40px_rgba(217,70,239,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-fuchsia-500/40 sm:hidden" />

        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-fuchsia-400" />
            <div>
              <h2 className="text-lg font-bold text-slate-100 font-display tracking-wide">
                Manage Shisha Flavors
              </h2>
              <p className="text-xs text-slate-400">
                <span className="text-emerald-300 font-mono">{availableCount} in stock</span>
                {' · '}
                <span className="text-amber-300 font-mono">{soldOutCount} sold out</span>
                {' · Syncs live to all staff'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:bg-cyan-500/10 hover:text-cyan-200"
            aria-label="Close flavor manager"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Add New Flavor Form */}
        <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
          <input
            type="text"
            value={newFlavorName}
            onChange={(e) => setNewFlavorName(e.target.value)}
            placeholder="Add new flavor (e.g. Mint Frost, White Gummy)"
            className="flex-1 min-h-[44px] rounded-xl border border-cyan-500/30 bg-[#060913] px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newFlavorName.trim()}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl bg-cyan-400 px-4 text-xs font-bold text-slate-950 transition-colors hover:bg-cyan-300 cyber-glow-cyan disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </form>

        {/* Flavor List */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-0.5">
          {flavors.length === 0 ? (
            <p className="rounded-xl border border-dashed border-cyan-500/25 py-8 text-center text-xs text-slate-500">
              No flavors configured yet. Add your first shisha flavor above.
            </p>
          ) : (
            flavors.map((flavor) => (
              <div
                key={flavor.id}
                className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 transition-colors ${
                  flavor.available
                    ? 'border-cyan-500/20 bg-[#060913]'
                    : 'border-amber-500/30 bg-amber-500/[0.06]'
                }`}
              >
                <span
                  className={`min-w-0 flex-1 truncate text-sm font-semibold ${
                    flavor.available
                      ? 'text-slate-100'
                      : 'text-slate-400 line-through'
                  }`}
                >
                  {flavor.name}
                </span>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleAvailability(flavor.id)}
                    className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition-colors ${
                      flavor.available
                        ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                        : 'border-amber-400/45 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                    }`}
                  >
                    {flavor.available ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Available
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3.5 w-3.5" />
                        Sold Out
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onRemoveFlavor(flavor.id)}
                    className="flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-rose-500/25 bg-rose-500/10 text-rose-300 hover:border-rose-400 hover:bg-rose-500/20"
                    aria-label={`Remove ${flavor.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-cyan-500/20">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] w-full rounded-xl border border-cyan-500/30 bg-[#060913] text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
