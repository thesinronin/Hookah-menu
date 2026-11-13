import type { KitchenTicketPayload, PrinterPaperWidth } from '../types.ts';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

function encodeAscii(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes.push(code >= 0x20 && code <= 0x7e ? code : 0x3f);
  }
  return bytes;
}

function line(str: string): number[] {
  return [...encodeAscii(str), LF];
}

/**
 * Generates raw ESC/POS command bytes for 58mm (32 cols) or 80mm (42/48 cols)
 * thermal kitchen printers. Emphasizes Table Number and Bowl Selection.
 */
export function buildEscPosBuffer(
  ticket: KitchenTicketPayload,
  paperWidth: PrinterPaperWidth = '80mm'
): Uint8Array {
  const cols = paperWidth === '58mm' ? 32 : 42;
  const divider = '-'.repeat(cols);
  const boldDivider = '='.repeat(cols);
  const timeStr = new Date(ticket.printedAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const chunks: number[] = [
    // Initialize printer
    ESC, 0x40,
    // Center align header
    ESC, 0x61, 0x01,
    // Emphasized on
    ESC, 0x45, 0x01,
    ...line('SIN-OS KITCHEN'),
    // Double width + double height for Table #
    GS, 0x21, 0x11,
    ...line(`TABLE #${ticket.tableNumber || ticket.tableName}`),
    // Normal size
    GS, 0x21, 0x00,
    ESC, 0x45, 0x00,
    ...line(`${ticket.floor} / ${ticket.zone} (${ticket.tableName})`),
    ...line(boldDivider),
    // Left align body
    ESC, 0x61, 0x00,
    ...line(`Time: ${timeStr}   Server: ${ticket.serverName || 'Staff'}`),
  ];

  if (ticket.guestName) {
    chunks.push(...line(`Guest: ${ticket.guestName}`));
  }
  chunks.push(...line(divider));

  for (const item of ticket.items) {
    // Item title (bold)
    chunks.push(ESC, 0x45, 0x01);
    chunks.push(...line(`${item.quantity}x ${item.name}`));
    // Bowl selection highlighted in double-height bold
    chunks.push(GS, 0x21, 0x01);
    chunks.push(...line(`BOWL: ${item.bowlSelection || 'Classic Clay'}`));
    chunks.push(GS, 0x21, 0x00);
    chunks.push(ESC, 0x45, 0x00);

    if (item.flavors && item.flavors.length > 0) {
      chunks.push(...line(`MIX: ${item.flavors.join(' + ')}`));
    }
    if (item.iceHose) {
      chunks.push(ESC, 0x45, 0x01);
      chunks.push(...line('+ ICE HOSE'));
      chunks.push(ESC, 0x45, 0x00);
    }
    if (item.notes) {
      chunks.push(...line(`NOTE: ${item.notes}`));
    }
    chunks.push(...line(divider));
  }

  chunks.push(
    ESC, 0x61, 0x01,
    ...line('PREP IMMEDIATELY'),
    LF, LF, LF, LF,
    // Partial cut
    GS, 0x56, 0x42, 0x00
  );

  return new Uint8Array(chunks);
}

export async function printViaNetworkEscPos(
  ticket: KitchenTicketPayload,
  printerIp: string,
  printerPort = 9100,
  paperWidth: PrinterPaperWidth = '80mm'
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/print/kitchen-ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      printerIp,
      printerPort,
      paperWidth,
      ticket,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };
  if (!res.ok || !data.ok) {
    return {
      ok: false,
      error: data.error || `Printer request failed (${res.status})`,
    };
  }
  return { ok: true };
}

interface BlePrinterSession {
  writeChar: {
    writeValueWithoutResponse?: (data: BufferSource) => Promise<void>;
    writeValue: (data: BufferSource) => Promise<void>;
  };
  deviceName: string;
}

let cachedBlePrinter: BlePrinterSession | null = null;

const BLE_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
];

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

export async function printViaBluetoothEscPos(
  ticket: KitchenTicketPayload,
  paperWidth: PrinterPaperWidth = '80mm'
): Promise<{ ok: boolean; deviceName?: string; error?: string }> {
  if (!isWebBluetoothSupported()) {
    return {
      ok: false,
      error:
        'Web Bluetooth is not available in this browser. Use Android Chrome or System Thermal Print.',
    };
  }

  try {
    if (!cachedBlePrinter) {
      const navBle = navigator as unknown as {
        bluetooth: {
          requestDevice: (opts: unknown) => Promise<{
            name?: string;
            gatt?: {
              connect: () => Promise<{
                getPrimaryService: (uuid: string) => Promise<{
                  getCharacteristics: () => Promise<
                    Array<{
                      properties: { write?: boolean; writeWithoutResponse?: boolean };
                      writeValueWithoutResponse?: (d: BufferSource) => Promise<void>;
                      writeValue: (d: BufferSource) => Promise<void>;
                    }>
                  >;
                }>;
              }>;
            };
          }>;
        };
      };

      const device = await navBle.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLE_PRINTER_SERVICES,
      });

      const server = await device.gatt?.connect();
      if (!server) {
        return { ok: false, error: 'Could not connect to Bluetooth printer.' };
      }

      let foundChar: BlePrinterSession['writeChar'] | null = null;
      for (const serviceUuid of BLE_PRINTER_SERVICES) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          const chars = await service.getCharacteristics();
          const writable = chars.find(
            (c) => c.properties.writeWithoutResponse || c.properties.write
          );
          if (writable) {
            foundChar = writable;
            break;
          }
        } catch {
          // Try next standard thermal printer UUID
        }
      }

      if (!foundChar) {
        return {
          ok: false,
          error:
            'Bluetooth printer paired, but no writable ESC/POS characteristic was found. Try System Print with your Android printer driver.',
        };
      }

      cachedBlePrinter = {
        writeChar: foundChar,
        deviceName: device.name || 'Bluetooth Printer',
      };
    }

    const bytes = buildEscPosBuffer(ticket, paperWidth);
    const chunkSize = 100;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const slice = bytes.slice(offset, offset + chunkSize);
      if (cachedBlePrinter.writeChar.writeValueWithoutResponse) {
        await cachedBlePrinter.writeChar.writeValueWithoutResponse(slice);
      } else {
        await cachedBlePrinter.writeChar.writeValue(slice);
      }
    }

    return { ok: true, deviceName: cachedBlePrinter.deviceName };
  } catch (err) {
    cachedBlePrinter = null;
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Bluetooth thermal print cancelled or failed.',
    };
  }
}
