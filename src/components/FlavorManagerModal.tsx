import React, { useState } from 'react';
import { CheckCircle2, Plus, Sparkles, Trash2, X, XCircle } from 'lucide-react';
import type { FlavorCategory, FlavorOption } from '../types';

interface FlavorManagerModalProps {
  visible: boolean;
  flavors: FlavorOption[];
  onClose: () => void;
  onAddFlavor: (name: string, category?: FlavorCategory, recipe?: string) => void;
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
  const [newRecipe, setNewRecipe] = useState('');
  const [addCategory, setAddCategory] = useState<FlavorCategory>('flavor');

  if (!visible) return null;

  const singleFlavors = flavors.filter((f) => f.category !== 'blend');
  const blends = flavors.filter((f) => f.category === 'blend');
  const availableCount = flavors.filter((f) => f.available).length;
  const soldOutCount = flavors.length - availableCount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFlavorName.trim();
    if (!trimmed) return;
    onAddFlavor(
      trimmed,
      addCategory,
      addCategory === 'blend' ? newRecipe.trim() || undefined : undefined
    );
    setNewFlavorName('');
    setNewRecipe('');
  };

  const renderFlavorRow = (flavor: FlavorOption) => (
    <div
      key={flavor.id}
      className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 transition-colors ${
        flavor.available
          ? 'border-cyan-500/20 bg-[#060913]'
          : 'border-amber-500/30 bg-amber-500/[0.06]'
      }`}
    >
      <div className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm font-semibold ${
            flavor.available ? 'text-slate-100' : 'text-slate-400 line-through'
          }`}
        >
          {flavor.name}
        </span>
        {flavor.recipe && (
          <span className="block truncate text-[11px] text-slate-400">
            {flavor.recipe}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onToggleAvailability(flavor.id)}
          className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition-colors whitespace-nowrap ${
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
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 pt-safe pb-safe sm:p-4"
      onClick={onClose}
    >
      <div
        className="modal-safe-panel flex w-full sm:max-w-lg flex-col rounded-t-3xl sm:rounded-2xl border border-fuchsia-500/35 bg-[#0A0F1C] p-4 sm:p-5 pb-safe shadow-[0_0_40px_rgba(217,70,239,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-fuchsia-500/40 sm:hidden" />

        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-fuchsia-400" />
            <div>
              <h2 className="text-lg font-bold text-slate-100 font-display tracking-wide">
                Manage Shisha Flavors &amp; Blends
              </h2>
              <p className="text-xs text-slate-400">
                <span className="text-emerald-300 font-mono tabular-nums">
                  {availableCount} in stock
                </span>
                {' · '}
                <span className="text-amber-300 font-mono tabular-nums">
                  {soldOutCount} sold out
                </span>
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

        {/* Add New Flavor or Blend Form */}
        <form onSubmit={handleSubmit} className="mt-3.5 space-y-2">
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-cyan-500/25 bg-[#060913] p-1">
            <button
              type="button"
              onClick={() => setAddCategory('flavor')}
              className={`min-h-[36px] rounded-lg px-3 text-xs font-bold transition-colors whitespace-nowrap ${
                addCategory === 'flavor'
                  ? 'bg-cyan-400 text-slate-950'
                  : 'text-slate-300 hover:text-cyan-200'
              }`}
            >
              Single Flavor
            </button>
            <button
              type="button"
              onClick={() => setAddCategory('blend')}
              className={`min-h-[36px] rounded-lg px-3 text-xs font-bold transition-colors whitespace-nowrap ${
                addCategory === 'blend'
                  ? 'bg-fuchsia-500 text-white'
                  : 'text-slate-300 hover:text-fuchsia-200'
              }`}
            >
              Blend
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newFlavorName}
              onChange={(e) => setNewFlavorName(e.target.value)}
              placeholder={
                addCategory === 'blend'
                  ? 'Add blend name (e.g. Berry Frost)'
                  : 'Add flavor (e.g. Mint Frost, White Gummy)'
              }
              className="flex-1 min-h-[44px] rounded-xl border border-cyan-500/30 bg-[#060913] px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newFlavorName.trim()}
              className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl bg-cyan-400 px-4 text-xs font-bold text-slate-950 transition-colors hover:bg-cyan-300 cyber-glow-cyan disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>

          {addCategory === 'blend' && (
            <input
              type="text"
              value={newRecipe}
              onChange={(e) => setNewRecipe(e.target.value)}
              placeholder="Mix ingredients (optional, e.g. Blue Mist + Mint)"
              className="w-full min-h-[40px] rounded-xl border border-fuchsia-500/25 bg-[#060913] px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-fuchsia-400 focus:outline-none"
            />
          )}
        </form>

        {/* Blends & Single Flavors Sections */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-5 pr-0.5">
          {/* Blends Section */}
          <section className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-xs font-bold text-fuchsia-300 font-display tracking-wide">
                Blends
              </h3>
              <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                {blends.filter((b) => b.available).length}/{blends.length} in stock
              </span>
            </div>
            {blends.length === 0 ? (
              <p className="rounded-xl border border-dashed border-fuchsia-500/25 py-4 text-center text-xs text-slate-500">
                No house blends yet. Switch above to Blend to add one.
              </p>
            ) : (
              <div className="space-y-2">{blends.map(renderFlavorRow)}</div>
            )}
          </section>

          {/* Single Flavors Section */}
          <section className="space-y-2 border-t border-cyan-500/20 pt-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-xs font-bold text-cyan-300 font-display tracking-wide">
                Single Flavors
              </h3>
              <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                {singleFlavors.filter((f) => f.available).length}/{singleFlavors.length} in stock
              </span>
            </div>
            {singleFlavors.length === 0 ? (
              <p className="rounded-xl border border-dashed border-cyan-500/25 py-4 text-center text-xs text-slate-500">
                No single flavors configured yet.
              </p>
            ) : (
              <div className="space-y-2">{singleFlavors.map(renderFlavorRow)}</div>
            )}
          </section>
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
