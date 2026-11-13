import React, { useEffect, useState } from 'react';
import { CheckCircle2, Printer, SlidersHorizontal, Sparkles } from 'lucide-react';
import { FLOORS } from '../data/menu';
import type {
  LoungeTable,
  OrderItem,
  PrepStatus,
  TableFloor,
} from '../types';

interface HookahStationScreenProps {
  tables: LoungeTable[];
  onAdvancePrep: (tableId: string, orderId: string, nextStatus: PrepStatus) => void;
  onOpenFlavorManager: () => void;
  onPrintOrder: (table: LoungeTable, order: OrderItem) => void;
  onQuickPrintOrder: (table: LoungeTable, order: OrderItem) => void;
}

export const HookahStationScreen: React.FC<HookahStationScreenProps> = ({
  tables,
  onAdvancePrep,
  onOpenFlavorManager,
  onPrintOrder,
  onQuickPrintOrder,
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

  return (
    <div className="space-y-3 sm:space-y-5">
      {/* Floor Filter & Flavor Inventory */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="grid grid-cols-4 gap-1 rounded-xl border border-cyan-500/25 bg-[#0B101D] p-0.5 sm:p-1 flex-1 min-w-[220px] max-w-xl">
          {(['All', ...FLOORS] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFloorFilter(f)}
              className={`min-h-[32px] sm:min-h-[40px] rounded-lg px-1.5 sm:px-2 text-[11px] sm:text-xs font-bold transition-colors whitespace-nowrap font-display tracking-wide ${
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
          className="inline-flex min-h-[36px] sm:min-h-[44px] items-center gap-1.5 rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs font-bold text-fuchsia-200 transition-colors hover:bg-fuchsia-500/20 cyber-glow-magenta whitespace-nowrap shrink-0"
        >
          <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-fuchsia-400" />
          Flavors
        </button>
      </div>

      {/* Hookah Prep Queue */}
      <section className="space-y-3">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                      {order.kitchenPrintedAt && (
                        <p className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          Printed{' '}
                          {new Date(order.kitchenPrintedAt).toLocaleTimeString(
                            'en-US',
                            { hour: 'numeric', minute: '2-digit' }
                          )}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onQuickPrintOrder(table, order)}
                        className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-cyan-500/35 bg-[#060913] px-3 py-2.5 text-xs font-bold text-cyan-200 transition-colors hover:border-cyan-400 hover:bg-cyan-500/10 shrink-0"
                        title="1-tap print using saved printer settings"
                        aria-label="Quick print kitchen ticket"
                      >
                        <Printer className="h-4 w-4" />
                        Print
                      </button>
                      <button
                        type="button"
                        onClick={() => onPrintOrder(table, order)}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-cyan-500/25 bg-[#060913] text-slate-400 transition-colors hover:border-cyan-400 hover:text-cyan-200 shrink-0"
                        title="Edit Table # or printer options before printing"
                        aria-label="Print options"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
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
  );
};
