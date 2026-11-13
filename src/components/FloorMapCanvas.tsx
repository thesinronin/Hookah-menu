import React, { useEffect, useRef, useState } from 'react';
import { Flame, Move, Sun, Layers } from 'lucide-react';
import type { LoungeSettings, LoungeTable, TableFloor } from '../types';
import { formatDuration } from './TimerDisplay';

interface FloorMapCanvasProps {
  floor: TableFloor;
  tables: LoungeTable[];
  settings: LoungeSettings;
  isEditing: boolean;
  onSelectTable: (table: LoungeTable) => void;
  onMoveTable: (tableId: string, x: number, y: number) => void;
}

interface DraggableNodeProps {
  table: LoungeTable;
  now: number;
  settings: LoungeSettings;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  isEditing: boolean;
  onSelect: (table: LoungeTable) => void;
  onMove: (tableId: string, x: number, y: number) => void;
}

const DraggableTableNode: React.FC<DraggableNodeProps> = ({
  table,
  now,
  settings,
  canvasRef,
  isEditing,
  onSelect,
  onMove,
}) => {
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);

  const isOccupied = table.status === 'occupied';
  const isCoalDue =
    isOccupied &&
    table.lastCoalCheckAt !== undefined &&
    (now - table.lastCoalCheckAt) / 60_000 >= settings.coalAlertMinutes;

  const isLongStay =
    isOccupied &&
    table.seatedAt !== undefined &&
    (now - table.seatedAt) / 60_000 >=
      (table.timeLimitMinutes ?? settings.longStayAlertMinutes);

  const total = table.orders.reduce((s, o) => s + o.unitPrice * o.quantity, 0);
  const hookahCount = table.orders
    .filter((o) => o.category === 'hookah' || o.category === 'refill')
    .reduce((s, o) => s + o.quantity, 0);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isEditing) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      pointerId: e.pointerId,
    };
    setDragOffset({ dx: 0, dy: 0 });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isEditing || !pointerStartRef.current) return;
    if (pointerStartRef.current.pointerId !== e.pointerId) return;
    setDragOffset({
      dx: e.clientX - pointerStartRef.current.x,
      dy: e.clientY - pointerStartRef.current.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isEditing) {
      onSelect(table);
      return;
    }

    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    setDragOffset(null);

    if (!start) {
      onSelect(table);
      return;
    }

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const movedDist = Math.hypot(dx, dy);

    if (movedDist < 6) {
      onSelect(table);
      return;
    }

    const container = canvasRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dxPct = (dx / rect.width) * 100;
    const dyPct = (dy / rect.height) * 100;

    const nodeWidthPct = ((table.shape === 'booth' ? 140 : 114) / rect.width) * 100;
    const nodeHeightPct = (86 / rect.height) * 100;

    const maxX = Math.max(8, 98 - nodeWidthPct);
    const maxY = Math.max(8, 98 - nodeHeightPct);

    const rawX = Math.max(2, Math.min(maxX, table.x + dxPct));
    const rawY = Math.max(2, Math.min(maxY, table.y + dyPct));

    const snappedX = Math.round(rawX / 2) * 2;
    const snappedY = Math.round(rawY / 2) * 2;
    onMove(table.id, snappedX, snappedY);
  };

  const shapeClass =
    table.shape === 'round'
      ? 'rounded-full w-[108px] sm:w-[116px]'
      : table.shape === 'booth'
      ? 'rounded-2xl w-[132px] sm:w-[148px]'
      : 'rounded-xl w-[108px] sm:w-[118px]';

  const borderAndBg = isEditing
    ? 'border-dashed border-cyan-400/80 bg-[#0F1B2E] hover:bg-[#15243D]'
    : isCoalDue
    ? 'border-amber-400/90 bg-[#201609] hover:bg-[#291C0B]'
    : isLongStay
    ? 'border-fuchsia-500/85 bg-[#200C23] hover:bg-[#2A102E] cyber-glow-magenta'
    : isOccupied
    ? 'border-emerald-400/75 bg-[#071D1B] hover:bg-[#0B2724] cyber-glow-emerald'
    : 'border-cyan-500/25 bg-[#0B101D] hover:border-cyan-400/75 hover:bg-[#10192D]';

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        pointerStartRef.current = null;
        setDragOffset(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(table);
        }
      }}
      style={{
        left: `${table.x}%`,
        top: `${table.y}%`,
        transform: dragOffset
          ? `translate3d(${dragOffset.dx}px, ${dragOffset.dy}px, 0) scale(1.03)`
          : undefined,
        touchAction: isEditing ? 'none' : 'manipulation',
      }}
      className={`absolute flex h-[86px] select-none flex-col items-center justify-center border px-2.5 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${shapeClass} ${borderAndBg} ${
        isEditing ? 'cursor-grab active:cursor-grabbing z-20' : 'cursor-pointer z-10'
      }`}
    >
      <div className="flex items-center gap-1.5 max-w-full">
        <span className="truncate text-sm font-bold text-slate-100 font-display tracking-wide">
          {table.tableNumber ? `#${table.tableNumber} · ${table.name}` : table.name}
        </span>
        {isEditing && <Move className="h-3.5 w-3.5 shrink-0 text-cyan-400" />}
        {!isEditing && isCoalDue && (
          <Flame className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        )}
      </div>

      {isEditing ? (
        <span className="mt-1 text-[11px] text-slate-400 whitespace-nowrap">
          {table.zone} · {table.seats}p
        </span>
      ) : isOccupied && table.seatedAt ? (
        <div className="mt-1 flex flex-col items-center">
          <span
            className={`font-mono text-xs font-semibold tabular-nums ${
              isCoalDue
                ? 'text-amber-300'
                : isLongStay
                ? 'text-fuchsia-300'
                : 'text-emerald-300'
            }`}
          >
            {formatDuration(now - table.seatedAt)}
          </span>
          <span className="mt-0.5 font-mono text-[11px] text-cyan-200/90 tabular-nums">
            ${total.toFixed(0)} · {hookahCount} bowl{hookahCount === 1 ? '' : 's'}
          </span>
        </div>
      ) : (
        <span className="mt-1 text-[11px] text-slate-400 whitespace-nowrap">
          {table.zone} · {table.seats} seats
        </span>
      )}
    </div>
  );
};

export const FloorMapCanvas: React.FC<FloorMapCanvasProps> = ({
  floor,
  tables,
  settings,
  isEditing,
  onSelectTable,
  onMoveTable,
}) => {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const isOutside = floor === 'Outside';
  const floorSubtitle: Record<TableFloor, string> = {
    'Floor 1': '1st Floor · Main Lounge & Bar',
    'Floor 2': '2nd Floor · Mezzanine & VIP Booths',
    Outside: 'Outside Seating · Open-Air Patio & Cabanas',
  };

  return (
    <div className="flex flex-col gap-3">
      {isEditing && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-2.5 text-xs text-cyan-200">
          <span className="font-medium">
            Layout Editor active on {floor} — drag tables to reposition or tap a table to edit its floor, seats, or shape.
          </span>
        </div>
      )}

      <div
        ref={canvasRef}
        className={`relative h-[470px] sm:h-[540px] w-full overflow-hidden rounded-2xl border ${
          isOutside
            ? 'patio-grid-bg border-emerald-500/30'
            : 'floor-grid-bg border-cyan-500/25'
        }`}
      >
        <div className="pointer-events-none flex items-center justify-between border-b border-cyan-500/15 bg-[#050811]/70 px-4 py-2.5 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5 font-medium text-cyan-100">
            {isOutside ? (
              <Sun className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Layers className="h-3.5 w-3.5 text-cyan-400" />
            )}
            {floorSubtitle[floor]}
          </span>
          <span className="font-mono text-cyan-300 tabular-nums">
            {tables.filter((t) => t.status === 'occupied').length}/{tables.length} occupied
          </span>
        </div>

        <div className="relative h-[calc(100%-38px)] w-full">
          {tables.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-400">
              No tables assigned to {floor}. Turn on Edit Layout and add a table to populate this floor.
            </div>
          ) : (
            tables.map((t) => (
              <DraggableTableNode
                key={t.id}
                table={t}
                now={now}
                settings={settings}
                canvasRef={canvasRef}
                isEditing={isEditing}
                onSelect={onSelectTable}
                onMove={onMoveTable}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
