import React from 'react';
import type { KitchenTicketPayload, PrinterPaperWidth } from '../types';

interface ThermalReceiptPrintViewProps {
  ticket: KitchenTicketPayload | null;
  paperWidth: PrinterPaperWidth;
}

export const ThermalReceiptPrintView: React.FC<ThermalReceiptPrintViewProps> = ({
  ticket,
  paperWidth,
}) => {
  if (!ticket) return null;

  const timeStr = new Date(ticket.printedAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div
      id="thermal-kitchen-receipt"
      data-width={paperWidth}
      className="hidden print:block bg-white text-black font-mono text-[12px] leading-tight"
    >
      <div className="text-center border-b-2 border-dashed border-black pb-2 mb-2">
        <div className="text-xs font-bold tracking-widest">SIN-OS KITCHEN</div>
        <div className="mt-1 text-2xl font-black tracking-wide">
          TABLE #{ticket.tableNumber || ticket.tableName}
        </div>
        <div className="text-[11px] font-semibold">
          {ticket.floor} · {ticket.zone} ({ticket.tableName})
        </div>
      </div>

      <div className="text-[11px] border-b border-dashed border-black pb-1.5 mb-2 space-y-0.5">
        <div className="flex justify-between">
          <span>TIME: {timeStr}</span>
          <span>SERVER: {ticket.serverName || 'Staff'}</span>
        </div>
        {ticket.guestName && <div>GUEST: {ticket.guestName}</div>}
      </div>

      <div className="space-y-2.5 border-b-2 border-dashed border-black pb-2 mb-2">
        {ticket.items.map((item, idx) => (
          <div key={idx} className="border-b border-dotted border-black pb-2 last:border-b-0 last:pb-0">
            <div className="text-sm font-bold">
              {item.quantity}x {item.name}
            </div>
            <div className="mt-1 inline-block border-2 border-black px-1.5 py-0.5 text-sm font-black uppercase">
              BOWL: {item.bowlSelection || 'Classic Clay'}
            </div>
            {item.flavors && item.flavors.length > 0 && (
              <div className="mt-1 text-xs font-bold">
                MIX: {item.flavors.join(' + ')}
              </div>
            )}
            {item.iceHose && (
              <div className="mt-0.5 text-xs font-black">+ ICE HOSE</div>
            )}
            {item.notes && (
              <div className="mt-0.5 text-xs">NOTE: {item.notes}</div>
            )}
          </div>
        ))}
      </div>

      <div className="text-center text-[11px] font-bold pt-1">
        *** PREP IMMEDIATELY ***
      </div>
    </div>
  );
};
