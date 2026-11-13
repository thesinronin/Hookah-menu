import React, { useEffect, useState } from 'react';
import { CheckCircle2, Flame, Printer, Sparkles } from 'lucide-react';
import { FLOORS } from '../data/menu';
import type {
  LoungeSettings,
  LoungeTable,
  OrderItem,
  PrepStatus,
  TableFloor,
} from '../types';

interface HookahStationScreenProps {
  tables: LoungeTable[];
  settings: LoungeSettings;
  onAdvancePrep: (tableId: string, orderId: string, nextStatus: PrepStatus) => void;
  onRefreshCoals: (tableId: string) => void;
  onOpenFlavorManager: () => void;
  onPrintOrder: (table: LoungeTable, order: OrderItem) => void;
}

export const HookahStationScreen: React.FC<HookahStationScreenProps> = ({
  tables,
  settings,
  onAdvancePrep,
  onRefreshCoals,
  onOpenFlavorManager,
  onPrintOrder,
}) => {
  const [floorFilter, setFloorFilter] = useState<'All' | TableFloor>('All');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const scopedTables =
    floorFilter === 'All'
      ? tables
      : tables.filter((t) => t.floor === floorFilter);

  const pendingOrders: { table: LoungeTable; order: OrderItem }[] = [];
  scopedTables.forEach((table) => {
    table.orders.forEach((order) => {
      if (order.prepStatus !== 'served') {
        pendingOrders.push({ table, order });
      }
    });
  });

  pendingOrders.sort((a, b) => a.order.orderedAt - b.order.orderedAt);

  const coalDueTables = scopedTables
    .filter(
      (t) =>
        t.status === 'occupied' &&
        t.lastCoalCheckAt !== undefined &&
        (now - t.lastCoalCheckAt) / 60_000 >= settings.coalAlertMinutes
    )
    .sort((a, b) => (a.lastCoalCheckAt || 0) - (b.lastCoalCheckAt || 0));

  return (
    <div className="space-y-6">
      {/* Floor Filter & Flavor Inventory */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-4 gap-1.5 rounded-xl border border-cyan-500/25 bg-[#0B101D] p-1 flex-1 min-w-[260px] max-w-xl">
          {(['All', ...FLOORS] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFloorFilter(f)}
              className={`min-h-[40px] rounded-lg px-2 text-xs font-bold transition-colors whitespace-nowrap font-display tracking-wide ${
                floorFilter === f
                  ? 'bg-cyan-400 text-slate-950 cyber-glow-cyan'
                  : 'text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onOpenFlavorManager}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-2 text-xs font-bold text-fuchsia-200 transition-colors hover:bg-fuchsia-500/20 cyber-glow-magenta whitespace-nowrap shrink-0"
        >
          <Sparkles className="h-4 w-4 text-fuchsia-400" />
          Manage Flavors
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Coal Rotation Alerts */}
        <section className="lg:col-span-5 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-bold text-slate-100">
              Coal Rotation Alerts
            </h2>
            <span className="font-mono text-xs text-amber-400 tabular-nums">
              {coalDueTables.length} due
            </span>
          </div>

          {coalDueTables.length === 0 ? (
            <div className="rounded-2xl border cyber-surface p-6 text-center text-xs text-slate-400">
              <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-emerald-400" />
              All active tables in this view have fresh coals (alert at{' '}
              {settings.coalAlertMinutes}m).
            </div>
          ) : (
            <div className="space-y-2.5">
              {coalDueTables.map((t) => {
                const mins = Math.floor(
                  (now - (t.lastCoalCheckAt || now)) / 60_000
                );
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-amber-400/50 bg-amber-500/[0.08] p-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-100 font-display">
                        {t.floor} · {t.name}
                      </p>
                      <p className="mt-0.5 text-xs text-amber-300">
                        {t.zone} · Last coal check{' '}
                        <span className="font-mono font-semibold tabular-nums">
                          {mins}m
                        </span>{' '}
                        ago
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRefreshCoals(t.id)}
                      className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 whitespace-nowrap"
                    >
                      <Flame className="h-4 w-4" />
                      Coals Done
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Hookah Prep Queue */}
        <section className="lg:col-span-7 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-bold text-slate-100">
              Hookah Prep Queue
            </h2>
            <span className="font-mono text-xs text-cyan-300 tabular-nums">
              {pendingOrders.length} active ticket
              {pendingOrders.length === 1 ? '' : 's'}
            </span>
          </div>

          {pendingOrders.length === 0 ? (
            <div className="rounded-2xl border cyber-surface p-8 text-center text-xs text-slate-400">
              No bowls waiting to be packed. New hookah orders from any server device appear here automatically.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {pendingOrders.map(({ table, order }) => {
                const nextStatus: PrepStatus =
                  order.prepStatus === 'queued' ? 'prepping' : 'served';
                const waitMins = Math.max(
                  0,
                  Math.floor((now - order.orderedAt) / 60_000)
                );

                return (
                  <div
                    key={order.id}
                    className="flex flex-col justify-between rounded-2xl border cyber-surface p-4"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                        <span className="font-semibold text-cyan-300">
                          {table.floor} · {table.zone}
                        </span>
                        <span className="font-mono tabular-nums">
                          {waitMins}m ago
                        </span>
                      </div>

                      <h3 className="mt-1.5 text-base font-bold text-slate-100">
                        {table.tableNumber
                          ? `Table #${table.tableNumber} (${table.name})`
                          : table.name}{' '}
                        · {order.quantity}× {order.name}
                      </h3>

                      {order.flavors && (
                        <p className="mt-2 text-xs font-semibold text-fuchsia-300">
                          Mix: {order.flavors.join(' + ')}
                        </p>
                      )}
                      {order.iceHose && (
                        <p className="mt-1 text-xs text-cyan-200 font-semibold">
                          + Ice Hose
                        </p>
                      )}
                      {order.notes && (
                        <p className="mt-1.5 text-xs text-amber-300">
                          Note: {order.notes}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onPrintOrder(table, order)}
                        className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-cyan-500/35 bg-[#060913] px-3 py-2.5 text-xs font-bold text-cyan-200 transition-colors hover:border-cyan-400 hover:bg-cyan-500/10 shrink-0"
                        aria-label="Print kitchen ticket"
                      >
                        <Printer className="h-4 w-4" />
                        Print
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onAdvancePrep(table.id, order.id, nextStatus)
                        }
                        className={`min-h-[44px] flex-1 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-colors ${
                          order.prepStatus === 'queued'
                            ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300 cyber-glow-cyan'
                            : 'bg-emerald-400 text-slate-950 hover:bg-emerald-300 cyber-glow-emerald'
                        }`}
                      >
                        {order.prepStatus === 'queued'
                          ? 'Start Packing & Lighting Coals'
                          : 'Mark Delivered to Table'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
