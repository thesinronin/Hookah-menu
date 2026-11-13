import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { createInitialTables, DEFAULT_SETTINGS, TAX_RATE } from './src/data/menu.ts';
import type {
  ActiveStaffMember,
  BatchReport,
  CompletedSession,
  LoungeSettings,
  LoungeStateSnapshot,
  LoungeTable,
  OrderItem,
  PrepStatus,
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
      const tax = sub * TAX_RATE;
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
        total: sub + tax,
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

    const report: BatchReport = {
      id: `batch-${now}`,
      closedAt: now,
      closedBy: staffName,
      totalTabs: allDaySessions.length,
      autoClosedOpenTables: autoClosedSessions.length,
      subtotal,
      tax,
      total,
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

          case 'table:checkout': {
            const tableId = String(msg.tableId || '');
            const staffName = String(msg.staffName || 'Staff');
            const table = state.tables.find((t) => t.id === tableId);
            if (!table || !table.seatedAt) break;

            const subtotal = table.orders.reduce(
              (s, o) => s + o.unitPrice * o.quantity,
              0
            );
            const tax = subtotal * TAX_RATE;
            const session: CompletedSession = {
              id: `sess-${now}-${table.id}`,
              tableName: table.name,
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
              total: subtotal + tax,
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
              floor: TableFloor;
              zone: TableZone;
              seats: number;
              shape: TableShape;
            };
            if (!payload || !payload.name) break;

            if (payload.id) {
              const table = state.tables.find((t) => t.id === payload.id);
              if (!table) break;
              table.name = payload.name.trim();
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
            state.settings = {
              coalAlertMinutes: Math.max(
                5,
                Math.min(120, Number(nextSettings.coalAlertMinutes) || 25)
              ),
              longStayAlertMinutes: Math.max(
                15,
                Math.min(360, Number(nextSettings.longStayAlertMinutes) || 120)
              ),
            };
            scheduleSave();
            broadcast(wss, { type: 'settings:updated', settings: state.settings });
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
