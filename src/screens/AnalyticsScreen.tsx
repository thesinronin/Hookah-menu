import React from 'react';
import { FileText, Power } from 'lucide-react';
import { FLOORS, TAX_RATE } from '../data/menu';
import type { BatchReport, CompletedSession, LoungeTable } from '../types';

interface AnalyticsScreenProps {
  tables: LoungeTable[];
  history: CompletedSession[];
  lastBatchReport: BatchReport | null;
  onOpenExportDocs: (batch?: BatchReport | null) => void;
  onOpenBatchOut: () => void;
}

export const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({
  tables,
  history,
  lastBatchReport,
  onOpenExportDocs,
  onOpenBatchOut,
}) => {
  const closedRevenue = history.reduce((sum, s) => sum + s.total, 0);
  const openTablesCount = tables.filter((t) => t.status === 'occupied').length;
  const openRevenue = tables
    .filter((t) => t.status === 'occupied')
    .reduce(
      (sum, t) =>
        sum +
        t.orders.reduce((s, o) => s + o.unitPrice * o.quantity, 0) * (1 + TAX_RATE),
      0
    );

  const avgDuration =
    history.length > 0
      ? Math.round(
          history.reduce((sum, s) => sum + s.durationMinutes, 0) / history.length
        )
      : 0;

  const flavorCounts: Record<string, number> = {};
  history.forEach((session) => {
    session.orders.forEach((order) => {
      order.flavors?.forEach((flavor) => {
        flavorCounts[flavor] = (flavorCounts[flavor] || 0) + order.quantity;
      });
    });
  });

  // Also include active tables in flavor popularity if no closed sessions yet
  tables.forEach((t) => {
    t.orders.forEach((order) => {
      order.flavors?.forEach((flavor) => {
        flavorCounts[flavor] = (flavorCounts[flavor] || 0) + order.quantity;
      });
    });
  });

  const topFlavors = Object.entries(flavorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const maxFloorRev = Math.max(
    1,
    ...FLOORS.map((f) =>
      history
        .filter((s) => s.floor === f)
        .reduce((sum, s) => sum + s.total, 0)
    )
  );

  return (
    <div className="space-y-6">
      {/* Shift End-of-Day Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border cyber-surface p-4">
        <div>
          <h1 className="text-base font-bold text-slate-100">
            Daily Total &amp; End-of-Day Close
          </h1>
          <p className="text-xs text-slate-400">
            Combined daily total:{' '}
            <strong className="font-mono text-cyan-300 tabular-nums">
              ${(closedRevenue + openRevenue).toFixed(2)}
            </strong>{' '}
            ({history.length} closed · {openTablesCount} open)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenExportDocs(null)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-cyan-400/40 bg-[#060913] px-3.5 py-2 text-xs font-semibold text-cyan-200 transition-colors hover:border-cyan-300 hover:bg-cyan-500/10 whitespace-nowrap"
          >
            <FileText className="h-4 w-4 text-cyan-400" />
            Export Daily Total to Google Docs
          </button>

          <button
            type="button"
            onClick={onOpenBatchOut}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-fuchsia-500 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-fuchsia-400 cyber-glow-magenta whitespace-nowrap"
          >
            <Power className="h-4 w-4" />
            Close All Tables &amp; Batch Out
          </button>
        </div>
      </div>

      {/* Last Batch Out Archive Banner */}
      {lastBatchReport && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/35 bg-emerald-500/[0.07] p-4 cyber-glow-emerald">
          <div>
            <p className="text-xs font-semibold text-emerald-300">
              Last Batch Out ·{' '}
              {new Date(lastBatchReport.closedAt).toLocaleString('en-US')}
            </p>
            <p className="mt-0.5 text-sm text-slate-200">
              Batched{' '}
              <strong className="font-mono text-emerald-300 tabular-nums">
                ${lastBatchReport.total.toFixed(2)}
              </strong>{' '}
              across {lastBatchReport.totalTabs} tab
              {lastBatchReport.totalTabs === 1 ? '' : 's'} · Closed by{' '}
              {lastBatchReport.closedBy}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenExportDocs(lastBatchReport)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-emerald-400/40 bg-[#060913] px-3.5 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10 whitespace-nowrap"
          >
            <FileText className="h-4 w-4" />
            Export Last Batch to Google Docs
          </button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border cyber-surface p-4">
          <p className="text-xs text-slate-400">Closed Revenue</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-cyan-300 tabular-nums">
            ${closedRevenue.toFixed(2)}
          </p>
        </div>
        <div className="rounded-2xl border cyber-surface p-4">
          <p className="text-xs text-slate-400">Active Open Tabs</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-emerald-400 tabular-nums">
            ${openRevenue.toFixed(2)}
          </p>
        </div>
        <div className="rounded-2xl border cyber-surface p-4">
          <p className="text-xs text-slate-400">Closed Tables</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-fuchsia-300 tabular-nums">
            {history.length}
          </p>
        </div>
        <div className="rounded-2xl border cyber-surface p-4">
          <p className="text-xs text-slate-400">Avg Stay Duration</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-100 tabular-nums">
            {avgDuration}m
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Floor */}
        <section className="rounded-2xl border cyber-surface p-5">
          <h2 className="text-base font-bold text-slate-100 mb-4">
            Revenue by Floor
          </h2>
          <div className="space-y-4">
            {FLOORS.map((floor) => {
              const floorSessions = history.filter((s) => s.floor === floor);
              const floorTotal = floorSessions.reduce((sum, s) => sum + s.total, 0);
              const pct = Math.round((floorTotal / maxFloorRev) * 100);
              return (
                <div key={floor} className="space-y-1.5">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-slate-200">
                      {floor} · {floorSessions.length} closed tab
                      {floorSessions.length === 1 ? '' : 's'}
                    </span>
                    <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                      ${floorTotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-cyan-500/15">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 transition-all"
                      style={{ width: `${floorTotal > 0 ? Math.max(4, pct) : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Top Flavors */}
        <section className="rounded-2xl border cyber-surface p-5">
          <h2 className="text-base font-bold text-slate-100 mb-4">
            Popular Shisha Flavors (Shift Total)
          </h2>
          {topFlavors.length === 0 ? (
            <p className="text-xs text-slate-500">
              Order or close a hookah bowl to track flavor velocity.
            </p>
          ) : (
            <div className="divide-y divide-cyan-500/10">
              {topFlavors.map(([flavor, count]) => (
                <div
                  key={flavor}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <span className="font-medium text-slate-200">{flavor}</span>
                  <span className="font-mono text-xs font-semibold text-cyan-300 tabular-nums">
                    {count} bowl{count === 1 ? '' : 's'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Closed Tabs Ledger */}
      <section className="rounded-2xl border cyber-surface p-5">
        <h2 className="text-base font-bold text-slate-100 mb-3">
          Recent Closed Tabs
        </h2>
        {history.length === 0 ? (
          <p className="text-xs text-slate-500">
            No closed tables yet during this shift. Tap any occupied table to close its tab.
          </p>
        ) : (
          <div className="divide-y divide-cyan-500/10">
            {history.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-slate-100">
                    {s.floor} · {s.tableName}
                    {s.guestName ? ` (${s.guestName})` : ''}
                  </p>
                  <p className="text-xs text-slate-400">
                    Party of {s.partySize} · Stayed {s.durationMinutes} mins ·{' '}
                    {s.orders.length} item{s.orders.length === 1 ? '' : 's'}
                    {s.serverName ? ` · Server: ${s.serverName}` : ''}
                  </p>
                </div>
                <span className="font-mono text-sm font-bold text-emerald-400 tabular-nums">
                  ${s.total.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
