import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  createInitialFlavors,
  createInitialTables,
  DEFAULT_SETTINGS,
  getTableSeatingTier,
  getVipUpgradeOption,
} from './src/data/menu.ts';
import { buildEscPosBuffer } from './src/services/kitchenPrinter.ts';
import type {
  ActiveStaffMember,
  BatchReport,
  CompletedSession,
  FlavorOption,
  KitchenTicketPayload,
  LoungeSettings,
  LoungeStateSnapshot,
  LoungeTable,
  OrderItem,
  PaymentMethod,
  PrepStatus,
  PrinterMode,
  PrinterPaperWidth,
  SeatingTierId,
  StaffRole,
  TableFloor,
  TableShape,
  TableZone,
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.join(__dirname, '.lounge-state.json');

interface PersistedData {
  tables: LoungeTable[];
  history: CompletedSession[];
  settings: LoungeSettings;
  lastBatchReport: BatchReport | null;
  flavors: FlavorOption[];
}

function loadPersistedState(): PersistedData {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PersistedData>;
      if (Array.isArray(parsed.tables) && parsed.tables.length > 0) {
        return {
          tables: parsed.tables,
          history: Array.isArray(parsed.history) ? parsed.history : [],
          settings: parsed.settings ?? DEFAULT_SETTINGS,
          lastBatchReport: parsed.lastBatchReport ?? null,
          flavors:
            Array.isArray(parsed.flavors) && parsed.flavors.length > 0
              ? parsed.flavors
              : createInitialFlavors(),
        };
      }
    }
  } catch (err) {
    console.warn('Could not read persisted lounge state, initializing fresh:', err);
  }
  return {
    tables: createInitialTables(),
    history: [],
    settings: { ...DEFAULT_SETTINGS },
    lastBatchReport: null,
    flavors: createInitialFlavors(),
  };
}

const state: PersistedData = loadPersistedState();
const connectedStaff = new Map<WebSocket, ActiveStaffMember>();

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist lounge state:', err);
    }
  }, 150);
}

function getSnapshot(): LoungeStateSnapshot {
  return {
    tables: state.tables,
    history: state.history,
    settings: state.settings,
    activeStaff: Array.from(connectedStaff.values()),
    lastBatchReport: state.lastBatchReport,
    flavors: state.flavors,
  };
}

function broadcast(wss: WebSocketServer, payload: unknown) {
  const data = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

function broadcastPresence(wss: WebSocketServer) {
  broadcast(wss, {
    type: 'staff:presence',
    activeStaff: Array.from(connectedStaff.values()),
  });
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, connectedStaff: connectedStaff.size });
  });

  app.get('/api/state', (_req, res) => {
    res.json(getSnapshot());
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  function executeBatchOut(staffName: string): BatchReport {
    const now = Date.now();
    const autoClosedSessions: CompletedSession[] = [];

    for (const table of state.tables) {
      if (table.status !== 'occupied') continue;
      const seatedAt = table.seatedAt || now;
      const sub = table.orders.reduce(
        (s, o) => s + o.unitPrice * o.quantity,
        0
      );
      const tax = 0;
      autoClosedSessions.push({
        id: `sess-${now}-${table.id}`,
        tableName: table.name,
        floor: table.floor,
        zone: table.zone,
        partySize: table.partySize || 1,
        guestName: table.guestName,
        serverName: table.serverName || staffName,
        seatedAt,
        closedAt: now,
        durationMinutes: Math.max(
          1,
          Math.round((now - seatedAt) / 60_000)
        ),
        orders: table.orders,
        subtotal: sub,
        tax,
        total: sub,
        paymentMethod: 'card',
        cashPaid: 0,
        cardPaid: sub,
      });

      table.status = 'available';
      table.seatingTier = undefined;
      table.timeLimitMinutes = undefined;
      table.partySize = undefined;
      table.guestName = undefined;
      table.serverName = undefined;
      table.seatedAt = undefined;
      table.lastCoalCheckAt = undefined;
      table.orders = [];
      table.updatedAt = now;
    }

    const allDaySessions = [...autoClosedSessions, ...state.history];
    const subtotal = allDaySessions.reduce((s, x) => s + x.subtotal, 0);
    const tax = allDaySessions.reduce((s, x) => s + x.tax, 0);
    const total = allDaySessions.reduce((s, x) => s + x.total, 0);
    const cashTotal = allDaySessions.reduce(
      (s, x) => s + (x.cashPaid ?? (x.paymentMethod === 'cash' ? x.total : 0)),
      0
    );
    const cardTotal = allDaySessions.reduce(
      (s, x) =>
        s +
        (x.cardPaid ??
          (x.paymentMethod === 'cash' ? 0 : x.total - (x.cashPaid ?? 0))),
      0
    );

    const report: BatchReport = {
      id: `batch-${now}`,
      closedAt: now,
      closedBy: staffName,
      totalTabs: allDaySessions.length,
      autoClosedOpenTables: autoClosedSessions.length,
      subtotal,
      tax,
      total,
      cashTotal,
      cardTotal,
      sessions: allDaySessions,
    };

    state.lastBatchReport = report;
    state.history = [];

    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist batch out state:', err);
      scheduleSave();
    }

    broadcast(wss, { type: 'state:init', snapshot: getSnapshot() });
    return report;
  }

  app.post('/api/shift/batch-out', (req, res) => {
    const rawName = (req.body as { staffName?: unknown } | undefined)?.staffName;
    const staffName = String(rawName || 'Manager').trim() || 'Manager';
    const report = executeBatchOut(staffName);
    res.json({ ok: true, report, snapshot: getSnapshot() });
  });

  app.post('/api/print/kitchen-ticket', (req, res) => {
    const body = (req.body || {}) as {
      printerIp?: unknown;
      printerPort?: unknown;
      paperWidth?: unknown;
      ticket?: KitchenTicketPayload;
    };
    const printerIp = String(body.printerIp || '').trim();
    const printerPort = Math.max(1, Math.min(65535, Number(body.printerPort) || 9100));
    const paperWidth: PrinterPaperWidth =
      body.paperWidth === '58mm' ? '58mm' : '80mm';
    const ticket = body.ticket;

    if (!printerIp) {
      res.status(400).json({ ok: false, error: 'Missing printer IP address.' });
      return;
    }
    if (!ticket || !Array.isArray(ticket.items) || ticket.items.length === 0) {
      res.status(400).json({ ok: false, error: 'Kitchen ticket has no items to print.' });
      return;
    }

    const escPosBytes = Buffer.from(buildEscPosBuffer(ticket, paperWidth));
    const socket = net.createConnection({ host: printerIp, port: printerPort });
    let responded = false;

    socket.setTimeout(3500);
    socket.on('connect', () => {
      socket.write(escPosBytes, () => {
        socket.end();
        if (!responded) {
          responded = true;
          res.json({ ok: true, bytesSent: escPosBytes.length });
        }
      });
    });
    socket.on('timeout', () => {
      socket.destroy();
      if (!responded) {
        responded = true;
        res.status(502).json({
          ok: false,
          error: `Timed out connecting to thermal printer at ${printerIp}:${printerPort}. Check printer power/Wi-Fi or use Android/System Print.`,
        });
      }
    });
    socket.on('error', (err) => {
      socket.destroy();
      if (!responded) {
        responded = true;
        res.status(502).json({
          ok: false,
          error: `Could not reach thermal printer at ${printerIp}:${printerPort} (${err.message}).`,
        });
      }
    });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server, path: '/__vite_hmr' },
        ws: { server, path: '/__vite_hmr' },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '/', 'http://localhost').pathname;
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'state:init', snapshot: getSnapshot() }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: string;
          [key: string]: unknown;
        };
        const now = Date.now();

        switch (msg.type) {
          case 'staff:join': {
            const clientId = String(msg.clientId || '');
            const name = String(msg.name || 'Staff').trim() || 'Staff';
            const role = (msg.role as StaffRole) || 'Server';
            if (clientId) {
              connectedStaff.set(ws, {
                clientId,
                name,
                role,
                connectedAt: now,
              });
              broadcastPresence(wss);
            }
            break;
          }

          case 'table:seat': {
            const tableId = String(msg.tableId || '');
            const partySize = Math.max(1, Number(msg.partySize) || 2);
            const guestName = String(msg.guestName || '').trim() || undefined;
            const tableNumber = String(msg.tableNumber || '').trim() || undefined;
            const serverName = String(msg.serverName || 'Staff').trim();
            const initialOrders = Array.isArray(msg.initialOrders)
              ? (msg.initialOrders as OrderItem[]).map((o) => ({
                  ...o,
                  addedBy: o.addedBy || serverName,
                }))
              : [];

            const table = state.tables.find((t) => t.id === tableId);
            if (!table) break;

            table.status = 'occupied';
            if (tableNumber !== undefined) {
              table.tableNumber = tableNumber;
            }
            table.seatingTier = (msg.seatingTier as SeatingTierId | undefined) || undefined;
            table.timeLimitMinutes =
              typeof msg.timeLimitMinutes === 'number' && msg.timeLimitMinutes > 0
                ? msg.timeLimitMinutes
                : undefined;
            table.partySize = partySize;
            table.guestName = guestName;
            table.serverName = serverName;
            table.seatedAt = now;
            table.lastCoalCheckAt = now;
            table.orders = initialOrders;
            table.updatedAt = now;

            scheduleSave();
            broadcast(wss, { type: 'table:updated', table });
            break;
          }

          case 'table:updateNumber': {
            const tableId = String(msg.tableId || '');
            const tableNumber = String(msg.tableNumber || '').trim() || undefined;
            const table = state.tables.find((t) => t.id === tableId);
            if (!table) break;

            table.tableNumber = tableNumber;
            table.updatedAt = now;

            scheduleSave();
            broadcast(wss, { type: 'table:updated', table });
            break;
          }

          case 'table:addOrder': {
            const tableId = String(msg.tableId || '');
            const item = msg.item as OrderItem | undefined;
            if (!item || !item.id) break;

            const table = state.tables.find((t) => t.id === tableId);
            if (!table) break;

            // Idempotency check against duplicate socket retries
            if (table.orders.some((o) => o.id === item.id)) break;

            table.orders.push(item);
            if (item.category === 'hookah' || item.category === 'refill') {
              table.lastCoalCheckAt = now;
            }
            table.updatedAt = now;

            scheduleSave();
            broadcast(wss, { type: 'table:updated', table });
            break;
          }

          case 'table:updateQty': {
            const tableId = String(msg.tableId || '');
            const orderId = String(msg.orderId || '');
            const delta = Number(msg.delta) || 0;

            const table = state.tables.find((t) => t.id === tableId);
            if (!table) break;

            table.orders = table.orders
              .map((o) =>
                o.id === orderId ? { ...o, quantity: o.quantity + delta } : o
              )
              .filter((o) => o.quantity > 0);
            table.updatedAt = now;

            scheduleSave();
            broadcast(wss, { type: 'table:updated', table });
            break;
          }

          case 'table:refreshCoals': {
            const tableId = String(msg.tableId || '');
            const table = state.tables.find((t) => t.id === tableId);
            if (!table) break;

            table.lastCoalCheckAt = now;
            table.updatedAt = now;

            scheduleSave();
            broadcast(wss, { type: 'table:updated', table });
            break;
          }

          case 'table:advancePrep': {
            const tableId = String(msg.tableId || '');
            const orderId = String(msg.orderId || '');
            const nextStatus = msg.nextStatus as PrepStatus;

            const table = state.tables.find((t) => t.id === tableId);
            if (!table) break;

            table.orders = table.orders.map((o) =>
              o.id === orderId ? { ...o, prepStatus: nextStatus } : o
            );
            table.updatedAt = now;

            scheduleSave();
            broadcast(wss, { type: 'table:updated', table });
            break;
          }

          case 'table:upgradeVip': {
            const tableId = String(msg.tableId || '');
            const item = msg.item as OrderItem | undefined;

            const table = state.tables.find((t) => t.id === tableId);
            if (!table || table.status !== 'occupied') break;

            const currentTier = getTableSeatingTier(table);
            const upgradeOpt = getVipUpgradeOption(currentTier.id);
            if (!upgradeOpt) break;

            const upgradeItem: OrderItem = {
              id:
                item?.id ||
                `ord-${now}-${Math.random().toString(36).slice(2, 7)}-vip`,
              menuItemId: upgradeOpt.menuItemId,
              name: upgradeOpt.label,
              category: 'refill',
              unitPrice: upgradeOpt.price,
              quantity: 1,
              notes: item?.notes || `Upgraded ${currentTier.shortLabel} to All Day VIP`,
              addedBy: item?.addedBy || 'Staff',
              prepStatus: 'served',
              orderedAt: item?.orderedAt || now,
            };

            if (!table.orders.some((o) => o.id === upgradeItem.id)) {
              table.orders.push(upgradeItem);
            }
            table.seatingTier = 'vip_allday';
            table.timeLimitMinutes = undefined;
            table.updatedAt = now;

            scheduleSave();
            broadcast(wss, { type: 'table:updated', table });
            break;
          }

          case 'table:updateOrderFlavors': {
            const tableId = String(msg.tableId || '');
            const orderId = String(msg.orderId || '');
            const nextFlavors = Array.isArray(msg.flavors)
              ? (msg.flavors as unknown[])
                  .map((f) => String(f || '').trim())
                  .filter(Boolean)
                  .slice(0, 3)
              : [];

            const table = state.tables.find((t) => t.id === tableId);
            if (!table) break;

            table.orders = table.orders.map((o) =>
              o.id === orderId
                ? {
                    ...o,
                    flavors: nextFlavors.length > 0 ? nextFlavors : undefined,
                  }
                : o
            );
            table.updatedAt = now;

            scheduleSave();
            broadcast(wss, { type: 'table:updated', table });
            break;
          }

          case 'table:markPrinted': {
            const tableId = String(msg.tableId || '');
            const orderIds = Array.isArray(msg.orderIds)
              ? new Set((msg.orderIds as unknown[]).map((id) => String(id || '')))
              : null;
            const table = state.tables.find((t) => t.id === tableId);
            if (!table) break;

            table.orders = table.orders.map((o) =>
              !orderIds || orderIds.size === 0 || orderIds.has(o.id)
                ? { ...o, kitchenPrintedAt: now }
                : o
            );
            table.updatedAt = now;

            scheduleSave();
            broadcast(wss, { type: 'table:updated', table });
            break;
          }

          case 'table:transfer': {
            const fromTableId = String(msg.fromTableId || '');
            const toTableId = String(msg.toTableId || '');
            const upgradeToVipFlag = Boolean(msg.upgradeToVip);
            const staffName = String(msg.staffName || 'Staff').trim() || 'Staff';

            const fromTable = state.tables.find((t) => t.id === fromTableId);
            const toTable = state.tables.find((t) => t.id === toTableId);
            if (
              !fromTable ||
              !toTable ||
              fromTable.id === toTable.id ||
              fromTable.status !== 'occupied' ||
              toTable.status !== 'available'
            ) {
              break;
            }

            const movedOrders = [...fromTable.orders];
            const currentTier = getTableSeatingTier(fromTable);
            const upgradeOpt = getVipUpgradeOption(currentTier.id);
            let nextTier = fromTable.seatingTier;
            let nextLimit = fromTable.timeLimitMinutes;

            if (upgradeToVipFlag && upgradeOpt) {
              movedOrders.push({
                id: `ord-${now}-${Math.random().toString(36).slice(2, 7)}-vip`,
                menuItemId: upgradeOpt.menuItemId,
                name: upgradeOpt.label,
                category: 'refill',
                unitPrice: upgradeOpt.price,
                quantity: 1,
                notes: `Transferred & upgraded from ${fromTable.name}`,
                addedBy: staffName,
                prepStatus: 'served',
                orderedAt: now,
              });
              nextTier = 'vip_allday';
              nextLimit = undefined;
            }

            toTable.status = 'occupied';
            toTable.seatingTier = nextTier;
            toTable.timeLimitMinutes = nextLimit;
            toTable.partySize = fromTable.partySize;
            toTable.guestName = fromTable.guestName;
            toTable.serverName = fromTable.serverName || staffName;
            toTable.seatedAt = fromTable.seatedAt || now;
            toTable.lastCoalCheckAt = fromTable.lastCoalCheckAt || now;
            toTable.orders = movedOrders;
            toTable.updatedAt = now;

            fromTable.status = 'available';
            fromTable.seatingTier = undefined;
            fromTable.timeLimitMinutes = undefined;
            fromTable.partySize = undefined;
            fromTable.guestName = undefined;
            fromTable.serverName = undefined;
            fromTable.seatedAt = undefined;
            fromTable.lastCoalCheckAt = undefined;
            fromTable.orders = [];
            fromTable.updatedAt = now;

            scheduleSave();
            broadcast(wss, { type: 'table:updated', table: fromTable });
            broadcast(wss, { type: 'table:updated', table: toTable });
            break;
          }

          case 'table:checkout': {
            const tableId = String(msg.tableId || '');
            const staffName = String(msg.staffName || 'Staff');
            const table = state.tables.find((t) => t.id === tableId);
            if (!table || !table.seatedAt) break;

            const subtotal = table.orders.reduce(
              (s, o) => s + o.unitPrice * o.quantity,
              0
            );
            const tax = 0;
            const rawMethod = String(msg.paymentMethod || 'card');
            const paymentMethod: PaymentMethod =
              rawMethod === 'cash' || rawMethod === 'split' ? rawMethod : 'card';
            const cashPaid =
              paymentMethod === 'cash'
                ? subtotal
                : paymentMethod === 'split'
                ? Math.max(0, Math.min(subtotal, Number(msg.cashPaid) || 0))
                : 0;
            const cardPaid =
              paymentMethod === 'card'
                ? subtotal
                : Math.max(0, Number((subtotal - cashPaid).toFixed(2)));
            const splitWays =
              typeof msg.splitWays === 'number' && msg.splitWays > 1
                ? Math.min(20, Math.round(msg.splitWays))
                : undefined;

            const session: CompletedSession = {
              id: `sess-${now}-${table.id}`,
              tableName: table.tableNumber
                ? `#${table.tableNumber} · ${table.name}`
                : table.name,
              floor: table.floor,
              zone: table.zone,
              partySize: table.partySize || 1,
              guestName: table.guestName,
              serverName: table.serverName || staffName,
              seatedAt: table.seatedAt,
              closedAt: now,
              durationMinutes: Math.max(
                1,
                Math.round((now - table.seatedAt) / 60_000)
              ),
              orders: table.orders,
              subtotal,
              tax,
              total: subtotal,
              paymentMethod,
              cashPaid,
              cardPaid,
              splitWays,
            };

            state.history.unshift(session);
            if (state.history.length > 200) {
              state.history = state.history.slice(0, 200);
            }

            table.status = 'available';
            table.seatingTier = undefined;
            table.timeLimitMinutes = undefined;
            table.partySize = undefined;
            table.guestName = undefined;
            table.serverName = undefined;
            table.seatedAt = undefined;
            table.lastCoalCheckAt = undefined;
            table.orders = [];
            table.updatedAt = now;

            scheduleSave();
            broadcast(wss, { type: 'table:updated', table });
            broadcast(wss, { type: 'session:completed', session });
            break;
          }

          case 'layout:moveTable': {
            const tableId = String(msg.tableId || '');
            const x = Math.max(2, Math.min(84, Number(msg.x) || 0));
            const y = Math.max(2, Math.min(84, Number(msg.y) || 0));
            const table = state.tables.find((t) => t.id === tableId);
            if (!table) break;

            table.x = x;
            table.y = y;
            table.updatedAt = now;

            scheduleSave();
            broadcast(wss, { type: 'table:updated', table });
            break;
          }

          case 'layout:saveTable': {
            const payload = msg.data as {
              id?: string;
              name: string;
              tableNumber?: string;
              floor: TableFloor;
              zone: TableZone;
              seats: number;
              shape: TableShape;
            };
            if (!payload || !payload.name) break;
            const cleanTableNum = String(payload.tableNumber || '').trim() || undefined;

            if (payload.id) {
              const table = state.tables.find((t) => t.id === payload.id);
              if (!table) break;
              table.name = payload.name.trim();
              table.tableNumber = cleanTableNum;
              table.floor = payload.floor;
              table.zone = payload.zone;
              table.seats = Math.max(1, Number(payload.seats) || 4);
              table.shape = payload.shape;
              table.updatedAt = now;

              scheduleSave();
              broadcast(wss, { type: 'table:updated', table });
            } else {
              const newId = `t-${now}-${Math.random().toString(36).slice(2, 6)}`;
              const floorTables = state.tables.filter(
                (t) => t.floor === payload.floor
              );
              const offset = (floorTables.length % 4) * 14;
              const newTable: LoungeTable = {
                id: newId,
                name: payload.name.trim(),
                tableNumber: cleanTableNum,
                floor: payload.floor,
                zone: payload.zone,
                seats: Math.max(1, Number(payload.seats) || 4),
                shape: payload.shape,
                x: Math.min(72, 10 + offset),
                y: Math.min(72, 14 + offset),
                status: 'available',
                orders: [],
                updatedAt: now,
              };
              state.tables.push(newTable);

              scheduleSave();
              broadcast(wss, { type: 'table:updated', table: newTable });
            }
            break;
          }

          case 'layout:deleteTable': {
            const tableId = String(msg.tableId || '');
            const existing = state.tables.find((t) => t.id === tableId);
            if (!existing || existing.status === 'occupied') break;

            state.tables = state.tables.filter((t) => t.id !== tableId);
            scheduleSave();
            broadcast(wss, { type: 'table:deleted', tableId });
            break;
          }

          case 'settings:update': {
            const nextSettings = msg.settings as Partial<LoungeSettings>;
            if (!nextSettings) break;
            const modeVal: PrinterMode =
              nextSettings.kitchenPrinterMode === 'network' ||
              nextSettings.kitchenPrinterMode === 'bluetooth'
                ? nextSettings.kitchenPrinterMode
                : 'system';
            const widthVal: PrinterPaperWidth =
              nextSettings.kitchenPrinterWidth === '58mm' ? '58mm' : '80mm';
            state.settings = {
              coalAlertMinutes: Math.max(
                5,
                Math.min(120, Number(nextSettings.coalAlertMinutes) || 25)
              ),
              longStayAlertMinutes: Math.max(
                15,
                Math.min(360, Number(nextSettings.longStayAlertMinutes) || 120)
              ),
              kitchenPrinterMode: modeVal,
              kitchenPrinterIp: String(nextSettings.kitchenPrinterIp || '').trim(),
              kitchenPrinterPort: Math.max(
                1,
                Math.min(65535, Number(nextSettings.kitchenPrinterPort) || 9100)
              ),
              kitchenPrinterWidth: widthVal,
              autoPrintKitchenTicket: Boolean(nextSettings.autoPrintKitchenTicket),
              managerPin: String(nextSettings.managerPin || '')
                .replace(/\D/g, '')
                .slice(0, 6),
            };
            scheduleSave();
            broadcast(wss, { type: 'settings:updated', settings: state.settings });
            break;
          }

          case 'flavors:add': {
            const rawName = String(msg.name || '').trim();
            if (!rawName) break;
            const existing = state.flavors.find(
              (f) => f.name.toLowerCase() === rawName.toLowerCase()
            );
            if (existing) {
              existing.available = true;
            } else {
              state.flavors.push({
                id: `flv-${now}-${Math.random().toString(36).slice(2, 6)}`,
                name: rawName,
                available: true,
              });
            }
            scheduleSave();
            broadcast(wss, { type: 'flavors:updated', flavors: state.flavors });
            break;
          }

          case 'flavors:toggle': {
            const flavorId = String(msg.flavorId || '');
            const target = state.flavors.find((f) => f.id === flavorId);
            if (!target) break;
            target.available = !target.available;
            scheduleSave();
            broadcast(wss, { type: 'flavors:updated', flavors: state.flavors });
            break;
          }

          case 'flavors:remove': {
            const flavorId = String(msg.flavorId || '');
            state.flavors = state.flavors.filter((f) => f.id !== flavorId);
            scheduleSave();
            broadcast(wss, { type: 'flavors:updated', flavors: state.flavors });
            break;
          }

          case 'shift:batchOut': {
            const staffName = String(msg.staffName || 'Manager').trim() || 'Manager';
            executeBatchOut(staffName);
            break;
          }

          case 'state:resetDemo': {
            state.tables = createInitialTables(now);
            state.history = [];
            state.settings = { ...DEFAULT_SETTINGS };
            state.lastBatchReport = null;
            state.flavors = createInitialFlavors();
            scheduleSave();
            broadcast(wss, { type: 'state:init', snapshot: getSnapshot() });
            break;
          }
        }
      } catch (err) {
        console.warn('Invalid WS message:', err);
      }
    });

    ws.on('close', () => {
      if (connectedStaff.delete(ws)) {
        broadcastPresence(wss);
      }
    });
  });

  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`EmberPOS server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
