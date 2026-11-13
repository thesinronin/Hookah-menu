import React, { useEffect, useState } from 'react';
import {
  Bluetooth,
  CheckCircle2,
  Printer,
  Router,
  Smartphone,
  X,
} from 'lucide-react';
import {
  isWebBluetoothSupported,
  printViaBluetoothEscPos,
  printViaNetworkEscPos,
} from '../services/kitchenPrinter';
import type {
  KitchenTicketItem,
  KitchenTicketPayload,
  LoungeSettings,
  PrinterMode,
  PrinterPaperWidth,
} from '../types';

interface KitchenPrintModalProps {
  visible: boolean;
  ticket: KitchenTicketPayload | null;
  settings: LoungeSettings;
  onClose: () => void;
  onUpdateSettings: (next: LoungeSettings) => void;
  onSaveTableNumber?: (tableId: string, tableNumber: string) => void;
  onSystemPrint: (ticket: KitchenTicketPayload, width: PrinterPaperWidth) => void;
}

export const KitchenPrintModal: React.FC<KitchenPrintModalProps> = ({
  visible,
  ticket,
  settings,
  onClose,
  onUpdateSettings,
  onSaveTableNumber,
  onSystemPrint,
}) => {
  const [tableNumber, setTableNumber] = useState('');
  const [items, setItems] = useState<KitchenTicketItem[]>([]);
  const [mode, setMode] = useState<PrinterMode>(
    settings.kitchenPrinterMode || 'system'
  );
  const [printerIp, setPrinterIp] = useState(settings.kitchenPrinterIp || '');
  const [printerPort, setPrinterPort] = useState(
    String(settings.kitchenPrinterPort || 9100)
  );
  const [paperWidth, setPaperWidth] = useState<PrinterPaperWidth>(
    settings.kitchenPrinterWidth || '80mm'
  );
  const [isPrinting, setIsPrinting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!visible || !ticket) return;
    setTableNumber(ticket.tableNumber || ticket.tableName);
    setItems(ticket.items.map((it) => ({ ...it })));
    setMode(settings.kitchenPrinterMode || 'system');
    setPrinterIp(settings.kitchenPrinterIp || '');
    setPrinterPort(String(settings.kitchenPrinterPort || 9100));
    setPaperWidth(settings.kitchenPrinterWidth || '80mm');
    setStatusMsg('');
    setErrorMsg('');
  }, [visible, ticket, settings]);

  if (!visible || !ticket) return null;

  const cleanTableNum = tableNumber.trim() || ticket.tableName;
  const finalTicket: KitchenTicketPayload = {
    ...ticket,
    tableNumber: cleanTableNum,
    printedAt: Date.now(),
    items,
  };

  const persistPrinterConfig = () => {
    onUpdateSettings({
      ...settings,
      kitchenPrinterMode: mode,
      kitchenPrinterIp: printerIp.trim(),
      kitchenPrinterPort: Math.max(1, parseInt(printerPort, 10) || 9100),
      kitchenPrinterWidth: paperWidth,
    });
  };

  const handlePrint = async () => {
    setErrorMsg('');
    setStatusMsg('');

    if (ticket.tableId && onSaveTableNumber && tableNumber.trim()) {
      onSaveTableNumber(ticket.tableId, tableNumber.trim());
    }
    persistPrinterConfig();

    if (mode === 'system') {
      onSystemPrint(finalTicket, paperWidth);
      setStatusMsg('Sent ticket to device thermal print dialog.');
      return;
    }

    setIsPrinting(true);
    try {
      if (mode === 'network') {
        const ip = printerIp.trim();
        if (!ip) {
          setErrorMsg('Enter your kitchen thermal printer IP address (e.g. 192.168.1.50).');
          return;
        }
        const port = Math.max(1, parseInt(printerPort, 10) || 9100);
        const res = await printViaNetworkEscPos(finalTicket, ip, port, paperWidth);
        if (!res.ok) {
          setErrorMsg(res.error || 'Network thermal print failed.');
          return;
        }
        setStatusMsg(`Printed kitchen ticket to ${ip}:${port}`);
        return;
      }

      if (mode === 'bluetooth') {
        const res = await printViaBluetoothEscPos(finalTicket, paperWidth);
        if (!res.ok) {
          setErrorMsg(res.error || 'Bluetooth thermal print failed.');
          return;
        }
        setStatusMsg(`Printed via Bluetooth (${res.deviceName || 'Printer'}).`);
      }
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full sm:max-w-lg flex-col rounded-t-3xl sm:rounded-2xl border border-cyan-500/35 bg-[#0A0F1C] p-5 shadow-[0_0_40px_rgba(6,182,212,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-cyan-500/40 sm:hidden" />

        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
          <div className="flex items-center gap-2.5">
            <Printer className="h-5 w-5 text-cyan-400" />
            <div>
              <h2 className="text-lg font-bold text-slate-100 font-display tracking-wide">
                Kitchen Thermal Print
              </h2>
              <p className="text-xs text-slate-400">
                Prints Table # &amp; Flavor Mix to your kitchen printer
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:bg-cyan-500/10 hover:text-cyan-200"
            aria-label="Close kitchen print modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-0.5">
          {/* Table Number & Paper Width */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="kitchen-table-number"
                className="block text-xs font-medium text-cyan-200/80 mb-1.5"
              >
                Table Number (on ticket)
              </label>
              <input
                id="kitchen-table-number"
                type="text"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="e.g. 12 or VIP 1"
                className="w-full min-h-[44px] rounded-xl border border-cyan-500/30 bg-[#060913] px-3.5 py-2 font-mono text-sm font-bold text-cyan-200 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-cyan-200/80 mb-1.5">
                Thermal Paper Width
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {(['80mm', '58mm'] as PrinterPaperWidth[]).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setPaperWidth(w)}
                    className={`min-h-[44px] rounded-xl border font-mono text-xs font-bold transition-colors ${
                      paperWidth === w
                        ? 'border-cyan-400 bg-cyan-400 text-slate-950 cyber-glow-cyan'
                        : 'border-cyan-500/25 bg-[#060913] text-slate-300'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Kitchen Ticket Items */}
          <div className="space-y-2">
            <span className="block text-xs font-medium text-cyan-200/80">
              Items on Kitchen Ticket
            </span>
            {items.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-cyan-500/20 bg-[#060913] px-3 py-2.5 space-y-1"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-100">
                    {item.quantity}× {item.name}
                  </span>
                  {item.iceHose && (
                    <span className="font-mono text-[11px] font-semibold text-cyan-300">
                      + Ice Hose
                    </span>
                  )}
                </div>
                {item.flavors && item.flavors.length > 0 && (
                  <p className="text-xs font-semibold text-fuchsia-300">
                    Mix: {item.flavors.join(' + ')}
                  </p>
                )}
                {item.notes && (
                  <p className="text-[11px] text-slate-400">
                    Note: {item.notes}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Thermal Printer Transport */}
          <div className="space-y-2.5">
            <span className="block text-xs font-medium text-cyan-200/80">
              Kitchen Printer Connection
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setMode('system')}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-1.5 text-[11px] font-bold transition-colors ${
                  mode === 'system'
                    ? 'border-cyan-400 bg-cyan-400 text-slate-950 cyber-glow-cyan'
                    : 'border-cyan-500/25 bg-[#060913] text-slate-300'
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                Android / USB
              </button>
              <button
                type="button"
                onClick={() => setMode('network')}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-1.5 text-[11px] font-bold transition-colors ${
                  mode === 'network'
                    ? 'border-cyan-400 bg-cyan-400 text-slate-950 cyber-glow-cyan'
                    : 'border-cyan-500/25 bg-[#060913] text-slate-300'
                }`}
              >
                <Router className="h-3.5 w-3.5" />
                LAN IP :9100
              </button>
              <button
                type="button"
                onClick={() => setMode('bluetooth')}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-1.5 text-[11px] font-bold transition-colors ${
                  mode === 'bluetooth'
                    ? 'border-cyan-400 bg-cyan-400 text-slate-950 cyber-glow-cyan'
                    : 'border-cyan-500/25 bg-[#060913] text-slate-300'
                }`}
              >
                <Bluetooth className="h-3.5 w-3.5" />
                Bluetooth
              </button>
            </div>

            {mode === 'network' && (
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={printerIp}
                  onChange={(e) => setPrinterIp(e.target.value)}
                  placeholder="Printer IP (192.168.1.50)"
                  className="col-span-2 min-h-[44px] rounded-xl border border-cyan-500/25 bg-[#060913] px-3 py-2 font-mono text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                />
                <input
                  type="number"
                  value={printerPort}
                  onChange={(e) => setPrinterPort(e.target.value)}
                  placeholder="9100"
                  className="min-h-[44px] rounded-xl border border-cyan-500/25 bg-[#060913] px-3 py-2 font-mono text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </div>
            )}

            {mode === 'bluetooth' && !isWebBluetoothSupported() && (
              <p className="text-[11px] text-amber-300">
                Bluetooth BLE requires Android Chrome. You can also use Android / USB print with your thermal print service.
              </p>
            )}
          </div>

          {/* Live Thermal Ticket Preview */}
          <div className="rounded-xl border border-cyan-500/20 bg-[#060913] p-3 flex justify-center">
            <div
              className={`bg-white text-black font-mono rounded-sm p-3 shadow-md text-[11px] leading-tight ${
                paperWidth === '58mm' ? 'w-[220px]' : 'w-[290px]'
              }`}
            >
              <div className="text-center border-b-2 border-dashed border-black pb-1.5 mb-1.5">
                <div className="text-[10px] font-bold tracking-widest">
                  SIN-OS KITCHEN
                </div>
                <div className="mt-0.5 text-lg font-black">
                  TABLE #{cleanTableNum}
                </div>
                <div className="text-[10px]">
                  {ticket.floor} · {ticket.zone}
                </div>
              </div>

              <div className="space-y-2 border-b-2 border-dashed border-black pb-1.5 mb-1.5">
                {items.map((item, idx) => (
                  <div key={idx}>
                    <div className="font-bold">
                      {item.quantity}x {item.name}
                    </div>
                    {item.flavors && item.flavors.length > 0 && (
                      <div className="mt-0.5 inline-block border border-black px-1 py-0.5 text-[11px] font-black uppercase">
                        MIX: {item.flavors.join(' + ')}
                      </div>
                    )}
                    {item.iceHose && (
                      <div className="font-bold">+ ICE HOSE</div>
                    )}
                    {item.notes && <div>NOTE: {item.notes}</div>}
                  </div>
                ))}
              </div>
              <div className="text-center text-[10px] font-bold">
                PREP IMMEDIATELY
              </div>
            </div>
          </div>

          {statusMsg && (
            <p className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {statusMsg}
            </p>
          )}
          {errorMsg && (
            <p className="rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-2 text-xs text-fuchsia-300">
              {errorMsg}
            </p>
          )}
        </div>

        <div className="mt-4 flex gap-2 pt-3 border-t border-cyan-500/20">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] rounded-xl border border-cyan-500/30 px-4 text-sm font-semibold text-slate-300 hover:bg-slate-800"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-300 cyber-glow-cyan disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            {isPrinting ? 'Sending to Printer...' : 'Print Kitchen Ticket'}
          </button>
        </div>
      </div>
    </div>
  );
};
