import React, { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { FLOORS } from '../data/menu';
import type { LoungeTable, TableFloor, TableShape, TableZone } from '../types';

interface TableEditorModalProps {
  visible: boolean;
  table: LoungeTable | null;
  defaultFloor: TableFloor;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    name: string;
    tableNumber?: string;
    floor: TableFloor;
    zone: TableZone;
    seats: number;
    shape: TableShape;
  }) => void;
  onDelete: (tableId: string) => void;
}

export const TableEditorModal: React.FC<TableEditorModalProps> = ({
  visible,
  table,
  defaultFloor,
  onClose,
  onSave,
  onDelete,
}) => {
  const [name, setName] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [floor, setFloor] = useState<TableFloor>(defaultFloor);
  const [zone, setZone] = useState<TableZone>('Lounge');
  const [seats, setSeats] = useState('4');
  const [shape, setShape] = useState<TableShape>('square');
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setErrorMsg('');
    setConfirmDelete(false);
    if (table) {
      setName(table.name);
      setTableNumber(table.tableNumber || '');
      setFloor(table.floor);
      setZone(table.zone);
      setSeats(String(table.seats));
      setShape(table.shape);
    } else {
      setName('');
      setTableNumber('');
      setFloor(defaultFloor);
      setZone(defaultFloor === 'Outside' ? 'Patio' : 'Lounge');
      setSeats('4');
      setShape(defaultFloor === 'Outside' ? 'round' : 'square');
    }
  }, [table, defaultFloor, visible]);

  if (!visible) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = tableNumber.trim();
    const cleanName = name.trim() || (cleanNum ? `Table ${cleanNum}` : '');
    if (!cleanName) {
      setErrorMsg('Enter a table name or Table # such as 2F-3 or 12.');
      return;
    }
    onSave({
      id: table?.id,
      name: cleanName,
      tableNumber: cleanNum || undefined,
      floor,
      zone,
      seats: Math.max(1, parseInt(seats, 10) || 4),
      shape,
    });
    onClose();
  };

  const handleDeleteClick = () => {
    if (!table) return;
    if (table.status === 'occupied') {
      setErrorMsg('Close the active tab before deleting an occupied table.');
      return;
    }
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete(table.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 pt-safe pb-safe sm:p-4"
      onClick={onClose}
    >
      <div
        className="modal-safe-panel w-full sm:max-w-md overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-cyan-500/30 bg-[#0A0F1C] p-4 sm:p-5 pb-safe shadow-[0_0_40px_rgba(6,182,212,0.16)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-cyan-500/40 sm:hidden" />
        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
          <h2 className="text-lg font-bold text-slate-100 font-display tracking-wide">
            {table ? `Edit ${table.name}` : 'Add New Table'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:bg-cyan-500/10 hover:text-cyan-200"
            aria-label="Close table editor"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-cyan-200/80 mb-1.5">
                Table Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="e.g. 2F-VIP 3 or Cabana 2"
                className="w-full min-h-[44px] rounded-xl border border-cyan-500/25 bg-[#060913] px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-cyan-200/80 mb-1.5">
                Table #
              </label>
              <input
                type="text"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="e.g. 12"
                className="w-full min-h-[44px] rounded-xl border border-cyan-500/25 bg-[#060913] px-3 py-2.5 font-mono text-sm text-cyan-200 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-cyan-200/80 mb-1.5">
              Floor / Area
            </span>
            <div className="grid grid-cols-3 gap-2">
              {FLOORS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFloor(f)}
                  className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-bold transition-colors whitespace-nowrap ${
                    floor === f
                      ? 'border-cyan-400 bg-cyan-400 text-slate-950 cyber-glow-cyan'
                      : 'border-cyan-500/25 bg-[#060913] text-slate-300 hover:border-cyan-400/50'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-cyan-200/80 mb-1.5">
              Section
            </span>
            <div className="grid grid-cols-4 gap-2">
              {(['Lounge', 'VIP', 'Bar', 'Patio'] as TableZone[]).map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZone(z)}
                  className={`min-h-[44px] rounded-xl border px-2 py-2 text-xs font-bold transition-colors whitespace-nowrap ${
                    zone === z
                      ? 'border-cyan-400 bg-cyan-400 text-slate-950 cyber-glow-cyan'
                      : 'border-cyan-500/25 bg-[#060913] text-slate-300 hover:border-cyan-400/50'
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-cyan-200/80 mb-1.5">
                Seats
              </label>
              <input
                type="number"
                min={1}
                max={24}
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-cyan-500/25 bg-[#060913] px-3.5 py-2.5 font-mono text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-cyan-200/80 mb-1.5">
                Shape
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(['square', 'round', 'booth'] as TableShape[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setShape(s)}
                    className={`min-h-[44px] rounded-xl border px-1.5 py-2 text-xs font-bold capitalize transition-colors ${
                      shape === s
                        ? 'border-cyan-400 bg-cyan-400 text-slate-950 cyber-glow-cyan'
                        : 'border-cyan-500/25 bg-[#060913] text-slate-300 hover:border-cyan-400/50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {errorMsg && (
            <p className="rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-2 text-xs text-fuchsia-300">
              {errorMsg}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="submit"
              className="min-h-[48px] w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-300 cyber-glow-emerald"
            >
              Save Table
            </button>

            {table && (
              <button
                type="button"
                onClick={handleDeleteClick}
                className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                  confirmDelete
                    ? 'border-fuchsia-500 bg-fuchsia-500 text-white cyber-glow-magenta'
                    : 'border-fuchsia-500/35 bg-transparent text-fuchsia-300 hover:bg-fuchsia-500/10'
                }`}
              >
                <Trash2 className="h-4 w-4" />
                {confirmDelete ? `Confirm Delete ${table.name}` : 'Delete Table'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
