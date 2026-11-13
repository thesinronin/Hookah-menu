import React, { useState } from 'react';
import {
  Check,
  Edit3,
  LayoutGrid,
  List,
  Map as MapIcon,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';
import { FLOORS } from '../data/menu';
import type { LoungeSettings, LoungeTable, TableFloor } from '../types';
import { TimerDisplay } from '../components/TimerDisplay';
import { FloorMapCanvas } from '../components/FloorMapCanvas';

interface FloorPlanScreenProps {
  tables: LoungeTable[];
  settings: LoungeSettings;
  selectedFloor: TableFloor;
  onChangeFloor: (floor: TableFloor) => void;
  onSelectTable: (table: LoungeTable) => void;
  onEditTable: (table: LoungeTable) => void;
  onAddNewTable: () => void;
  onMoveTable: (tableId: string, x: number, y: number) => void;
  onRequireManagerPin: (actionLabel: string, action: () => void) => void;
}

export const FloorPlanScreen: React.FC<FloorPlanScreenProps> = ({
  tables,
  settings,
  selectedFloor,
  onChangeFloor,
  onSelectTable,
  onEditTable,
  onAddNewTable,
  onMoveTable,
  onRequireManagerPin,
}) => {
  const [viewMode, setViewMode] = useState<'map' | 'grid' | 'list'>('map');
  const [showAllInGrid, setShowAllInGrid] = useState(false);
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const totalOccupied = tables.filter((t) => t.status === 'occupied').length;
  const activeRevenue = tables
    .filter((t) => t.status === 'occupied')
    .reduce(
      (sum, t) =>
        sum + t.orders.reduce((s, o) => s + o.unitPrice * o.quantity, 0),
      0
    );

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const baseTables =
    normalizedQuery.length > 0 || (viewMode !== 'map' && showAllInGrid)
      ? tables
      : tables.filter((t) => t.floor === selectedFloor);

  const displayedTables = normalizedQuery
    ? baseTables.filter(
        (t) =>
          (t.tableNumber || '').toLowerCase().includes(normalizedQuery) ||
          t.name.toLowerCase().includes(normalizedQuery) ||
          (t.guestName || '').toLowerCase().includes(normalizedQuery)
      )
    : baseTables;

  const toggleEditLayout = () => {
    if (isEditingLayout) {
      setIsEditingLayout(false);
      return;
    }
    onRequireManagerPin('edit the floor layout', () => {
      setIsEditingLayout(true);
      setViewMode('map');
      setShowAllInGrid(false);
      setSearchQuery('');
    });
  };

  return (
    <div className="space-y-4">
      {/* Workspace Summary & Mode Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-slate-400">
          <span>
            Active Tables:{' '}
            <strong className="font-mono text-cyan-300 tabular-nums">
              {totalOccupied}/{tables.length}
            </strong>
          </span>
          <span aria-hidden="true" className="text-cyan-500/40">
            /
          </span>
          <span>
            Open Tabs:{' '}
            <strong className="font-mono text-emerald-400 tabular-nums">
              ${activeRevenue.toFixed(2)}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isEditingLayout && (
            <button
              type="button"
              onClick={onAddNewTable}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-fuchsia-500 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-fuchsia-400 cyber-glow-magenta whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              Add Table
            </button>
          )}

          <button
            type="button"
            onClick={toggleEditLayout}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              isEditingLayout
                ? 'border-emerald-400 bg-emerald-400 text-slate-950 cyber-glow-emerald'
                : 'border-cyan-500/30 bg-[#0B101D] text-cyan-100 hover:border-cyan-400/70'
            }`}
          >
            {isEditingLayout ? (
              <>
                <Check className="h-4 w-4" />
                Done Editing
              </>
            ) : (
              <>
                <Edit3 className="h-4 w-4 text-cyan-400" />
                Edit Layout
              </>
            )}
          </button>

          {!isEditingLayout && (
            <div className="flex items-center rounded-xl border border-cyan-500/25 bg-[#0B101D] p-1">
              <button
                type="button"
                onClick={() => {
                  setViewMode('map');
                  setShowAllInGrid(false);
                }}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors whitespace-nowrap ${
                  viewMode === 'map'
                    ? 'bg-cyan-400 text-slate-950 cyber-glow-cyan'
                    : 'text-slate-400 hover:text-cyan-200'
                }`}
              >
                <MapIcon className="h-3.5 w-3.5" />
                Map
              </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition-colors whitespace-nowrap ${
                    viewMode === 'grid'
                      ? 'bg-cyan-400 text-slate-950 cyber-glow-cyan'
                      : 'text-slate-400 hover:text-cyan-200'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Grid
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition-colors whitespace-nowrap ${
                    viewMode === 'list'
                      ? 'bg-cyan-400 text-slate-950 cyber-glow-cyan'
                      : 'text-slate-400 hover:text-cyan-200'
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  List
                </button>
            </div>
          )}
        </div>
      </div>

      {/* Floor Switcher & Quick Table # Lookup */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="grid flex-1 min-w-[240px] grid-cols-3 gap-1.5 rounded-xl border border-cyan-500/25 bg-[#0B101D] p-1">
          {FLOORS.map((floor) => {
            const floorTables = tables.filter((t) => t.floor === floor);
            const floorOcc = floorTables.filter((t) => t.status === 'occupied').length;
            const active = !showAllInGrid && !normalizedQuery && selectedFloor === floor;

            return (
              <button
                key={floor}
                type="button"
                onClick={() => {
                  setShowAllInGrid(false);
                  setSearchQuery('');
                  onChangeFloor(floor);
                }}
                className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition-colors whitespace-nowrap font-display tracking-wide ${
                  active
                    ? 'bg-cyan-400 text-slate-950 cyber-glow-cyan'
                    : 'text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200'
                }`}
              >
                <span>{floor}</span>
                <span
                  className={`font-mono text-[11px] tabular-nums ${
                    active ? 'text-slate-900/80' : 'text-cyan-400/70'
                  }`}
                >
                  {floorOcc}/{floorTables.length}
                </span>
              </button>
            );
          })}
        </div>

        {!isEditingLayout && (
          <div className="relative flex-1 sm:flex-none min-w-[175px] sm:w-52">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-400/70" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && displayedTables.length > 0) {
                  onSelectTable(displayedTables[0]);
                }
              }}
              placeholder="Jump Table # or guest..."
              aria-label="Search table number or guest"
              className="w-full min-h-[48px] rounded-xl border border-cyan-500/25 bg-[#0B101D] pl-9 pr-8 text-xs font-medium text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear table search"
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {viewMode !== 'map' && !isEditingLayout && (
          <button
            type="button"
            onClick={() => setShowAllInGrid((v) => !v)}
            className={`min-h-[48px] rounded-xl border px-4 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
              showAllInGrid
                ? 'border-fuchsia-400 bg-fuchsia-500 text-white cyber-glow-magenta'
                : 'border-cyan-500/25 bg-[#0B101D] text-cyan-100 hover:border-cyan-400/60'
            }`}
          >
            All Floors
          </button>
        )}
      </div>

      {/* Main Floor View */}
      {viewMode === 'map' && !normalizedQuery ? (
        <FloorMapCanvas
          floor={selectedFloor}
          tables={displayedTables}
          settings={settings}
          isEditing={isEditingLayout}
          onSelectTable={(t) =>
            isEditingLayout ? onEditTable(t) : onSelectTable(t)
          }
          onMoveTable={onMoveTable}
        />
      ) : viewMode === 'list' ? (
        <div className="divide-y divide-cyan-500/15 rounded-2xl border border-cyan-500/25 bg-[#0B101D] overflow-hidden">
          {displayedTables.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-400">
              No matching tables found.
            </p>
          ) : (
            displayedTables.map((table) => {
              const isOccupied = table.status === 'occupied';
              const total = table.orders.reduce(
                (s, o) => s + o.unitPrice * o.quantity,
                0
              );
              return (
                <button
                  key={table.id}
                  type="button"
                  onClick={() =>
                    isEditingLayout ? onEditTable(table) : onSelectTable(table)
                  }
                  className="flex min-h-[58px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-cyan-500/[0.06]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {table.tableNumber && (
                        <span className="rounded border border-cyan-400/50 bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-cyan-300">
                          #{table.tableNumber}
                        </span>
                      )}
                      <span className="font-bold text-sm text-slate-100 truncate font-display">
                        {table.name}
                      </span>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        {table.floor} · {table.zone}
                      </span>
                    </div>
                    {isOccupied && table.seatedAt ? (
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        <TimerDisplay
                          seatedAt={table.seatedAt}
                          lastCoalCheckAt={table.lastCoalCheckAt}
                          coalAlertMinutes={settings.coalAlertMinutes}
                          longStayAlertMinutes={settings.longStayAlertMinutes}
                          timeLimitMinutes={table.timeLimitMinutes}
                          compact
                        />
                        {table.guestName && (
                          <span className="text-slate-300 truncate">
                            · {table.guestName}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Available · {table.seats} seats
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {isOccupied ? (
                      <span className="font-mono text-sm font-bold text-emerald-400 tabular-nums">
                        ${total.toFixed(2)}
                      </span>
                    ) : (
                      <span className="rounded-lg border border-cyan-500/25 px-2.5 py-1 text-[11px] font-semibold text-cyan-300">
                        Seat
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {displayedTables.map((table) => {
            const isOccupied = table.status === 'occupied';
            const total = table.orders.reduce(
              (s, o) => s + o.unitPrice * o.quantity,
              0
            );
            const hookahCount = table.orders
              .filter((o) => o.category === 'hookah' || o.category === 'refill')
              .reduce((s, o) => s + o.quantity, 0);

            const orderSummary = table.orders
              .map((o) =>
                o.flavors
                  ? `${o.quantity}× ${o.flavors.join('+')}`
                  : `${o.quantity}× ${o.name}`
              )
              .slice(0, 2)
              .join(', ');

            return (
              <button
                key={table.id}
                type="button"
                onClick={() =>
                  isEditingLayout ? onEditTable(table) : onSelectTable(table)
                }
                className={`flex min-h-[164px] flex-col justify-between rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                  isOccupied
                    ? 'border-cyan-400/50 bg-[#0D1629] hover:border-cyan-300 cyber-glow-cyan'
                    : 'border-cyan-500/20 bg-[#0B101D] hover:border-cyan-400/55'
                }`}
              >
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-lg font-bold text-slate-100 truncate font-display tracking-wide">
                      {table.tableNumber ? `#${table.tableNumber} · ${table.name}` : table.name}
                    </h3>
                    <span className="text-xs text-cyan-300/70 whitespace-nowrap shrink-0">
                      {table.floor} · {table.zone}
                    </span>
                  </div>

                  {isOccupied && table.seatedAt ? (
                    <div className="mt-2.5 space-y-2">
                      <TimerDisplay
                        seatedAt={table.seatedAt}
                        lastCoalCheckAt={table.lastCoalCheckAt}
                        coalAlertMinutes={settings.coalAlertMinutes}
                        longStayAlertMinutes={settings.longStayAlertMinutes}
                        timeLimitMinutes={table.timeLimitMinutes}
                        compact
                      />

                      <p className="flex items-center gap-1.5 text-xs text-slate-300 truncate">
                        <Users className="h-3.5 w-3.5 shrink-0 text-cyan-400/80" />
                        <span>
                          Party of {table.partySize}
                          {table.guestName ? ` · ${table.guestName}` : ''}
                          {table.serverName ? ` · ${table.serverName}` : ''}
                        </span>
                      </p>

                      <p className="line-clamp-2 text-xs text-slate-400">
                        {table.orders.length > 0 ? orderSummary : 'No orders yet'}
                        {table.orders.length > 2
                          ? ` (+${table.orders.length - 2} more)`
                          : ''}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-6 text-xs text-slate-400">
                      {table.seats} seats · Available — tap to seat party
                    </p>
                  )}
                </div>

                {isOccupied ? (
                  <div className="mt-3 flex items-center justify-between border-t border-cyan-500/15 pt-2.5 text-xs">
                    <span className="text-cyan-200/70 font-mono">
                      {hookahCount} hookah{hookahCount === 1 ? '' : 's'}
                    </span>
                    <span className="font-mono text-sm font-bold text-emerald-400 tabular-nums">
                      ${total.toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center justify-between border-t border-cyan-500/10 pt-2.5 text-xs text-slate-500">
                    <span>Ready</span>
                    <span>{table.shape}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
