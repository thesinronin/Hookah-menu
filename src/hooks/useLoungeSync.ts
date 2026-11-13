import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createInitialFlavors,
  createInitialTables,
  DEFAULT_SETTINGS,
  VIP_UPGRADE_PRICE,
} from '../data/menu';
import type {
  ActiveStaffMember,
  BatchReport,
  CompletedSession,
  FlavorOption,
  LoungeSettings,
  LoungeStateSnapshot,
  LoungeTable,
  OrderItem,
  PrepStatus,
  SeatingTierId,
  StaffProfile,
  TableFloor,
  TableShape,
  TableZone,
} from '../types';

type OutgoingAction = {
  type: string;
  [key: string]: unknown;
};

export function useLoungeSync(staff: StaffProfile) {
  const [tables, setTables] = useState<LoungeTable[]>(() => createInitialTables());
  const [history, setHistory] = useState<CompletedSession[]>([]);
  const [settings, setSettings] = useState<LoungeSettings>(DEFAULT_SETTINGS);
  const [activeStaff, setActiveStaff] = useState<ActiveStaffMember[]>([]);
  const [lastBatchReport, setLastBatchReport] = useState<BatchReport | null>(null);
  const [flavors, setFlavors] = useState<FlavorOption[]>(() => createInitialFlavors());
  const [connectionState, setConnectionState] = useState<'connecting' | 'live' | 'reconnecting'>('connecting');

  const wsRef = useRef<WebSocket | null>(null);
  const pendingQueueRef = useRef<OutgoingAction[]>([]);
  const staffRef = useRef(staff);
  staffRef.current = staff;

  const sendAction = useCallback((action: OutgoingAction) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(action));
    } else {
      pendingQueueRef.current.push(action);
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let reconnectAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    // Load initial snapshot via HTTP immediately for fast first paint
    fetch('/api/state')
      .then((res) => (res.ok ? res.json() : null))
      .then((snapshot: LoungeStateSnapshot | null) => {
        if (!disposed && snapshot && Array.isArray(snapshot.tables)) {
          setTables(snapshot.tables);
          setHistory(snapshot.history || []);
          setSettings(snapshot.settings || DEFAULT_SETTINGS);
          setActiveStaff(snapshot.activeStaff || []);
          setLastBatchReport(snapshot.lastBatchReport ?? null);
          if (Array.isArray(snapshot.flavors) && snapshot.flavors.length > 0) {
            setFlavors(snapshot.flavors);
          }
        }
      })
      .catch(() => {});

    const connect = () => {
      if (disposed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) return;
        reconnectAttempt = 0;
        setConnectionState('live');

        // Register staff presence
        ws.send(
          JSON.stringify({
            type: 'staff:join',
            clientId: staffRef.current.clientId,
            name: staffRef.current.name,
            role: staffRef.current.role,
          })
        );

        // Flush queued mutations buffered during disconnect
        if (pendingQueueRef.current.length > 0) {
          const queued = [...pendingQueueRef.current];
          pendingQueueRef.current = [];
          for (const msg of queued) {
            ws.send(JSON.stringify(msg));
          }
        }
      };

      ws.onmessage = (event) => {
        if (disposed) return;
        try {
          const msg = JSON.parse(event.data) as {
            type: string;
            snapshot?: LoungeStateSnapshot;
            table?: LoungeTable;
            tableId?: string;
            session?: CompletedSession;
            settings?: LoungeSettings;
            activeStaff?: ActiveStaffMember[];
            flavors?: FlavorOption[];
          };

          switch (msg.type) {
            case 'state:init':
              if (msg.snapshot) {
                setTables(msg.snapshot.tables);
                setHistory(msg.snapshot.history);
                setSettings(msg.snapshot.settings);
                setActiveStaff(msg.snapshot.activeStaff);
                setLastBatchReport(msg.snapshot.lastBatchReport ?? null);
                if (Array.isArray(msg.snapshot.flavors)) {
                  setFlavors(msg.snapshot.flavors);
                }
              }
              break;
            case 'table:updated':
              if (msg.table) {
                const incoming = msg.table;
                setTables((prev) => {
                  const idx = prev.findIndex((t) => t.id === incoming.id);
                  if (idx === -1) return [...prev, incoming];
                  const next = [...prev];
                  next[idx] = incoming;
                  return next;
                });
              }
              break;
            case 'table:deleted':
              if (msg.tableId) {
                setTables((prev) => prev.filter((t) => t.id !== msg.tableId));
              }
              break;
            case 'session:completed':
              if (msg.session) {
                const incoming = msg.session;
                setHistory((prev) =>
                  prev.some((s) => s.id === incoming.id) ? prev : [incoming, ...prev]
                );
              }
              break;
            case 'settings:updated':
              if (msg.settings) {
                setSettings(msg.settings);
              }
              break;
            case 'staff:presence':
              if (msg.activeStaff) {
                setActiveStaff(msg.activeStaff);
              }
              break;
            case 'flavors:updated':
              if (Array.isArray(msg.flavors)) {
                setFlavors(msg.flavors);
              }
              break;
          }
        } catch {
          // Ignore malformed message
        }
      };

      ws.onclose = () => {
        if (disposed) return;
        setConnectionState('reconnecting');
        const delay = Math.min(8000, 800 * Math.pow(1.6, reconnectAttempt));
        reconnectAttempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  // Re-broadcast staff profile update when name or role changes
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'staff:join',
          clientId: staff.clientId,
          name: staff.name,
          role: staff.role,
        })
      );
    }
  }, [staff.clientId, staff.name, staff.role]);

  // Optimistic actions + server broadcast
  const seatTable = useCallback(
    (
      tableId: string,
      partySize: number,
      guestName: string,
      initialOrders: OrderItem[] = [],
      seatingTier?: SeatingTierId,
      timeLimitMinutes?: number,
      tableNumber?: string
    ) => {
      const now = Date.now();
      const cleanTableNum = tableNumber?.trim() || undefined;
      const enrichedOrders = initialOrders.map((o) => ({
        ...o,
        addedBy: o.addedBy || staffRef.current.name,
      }));
      setTables((prev) =>
        prev.map((t) =>
          t.id === tableId
            ? {
                ...t,
                status: 'occupied',
                tableNumber: cleanTableNum !== undefined ? cleanTableNum : t.tableNumber,
                seatingTier,
                timeLimitMinutes,
                partySize,
                guestName: guestName.trim() || undefined,
                serverName: staffRef.current.name,
                seatedAt: now,
                lastCoalCheckAt: now,
                orders: enrichedOrders,
                updatedAt: now,
              }
            : t
        )
      );
      sendAction({
        type: 'table:seat',
        tableId,
        partySize,
        guestName,
        tableNumber: cleanTableNum,
        serverName: staffRef.current.name,
        initialOrders: enrichedOrders,
        seatingTier,
        timeLimitMinutes,
      });
    },
    [sendAction]
  );

  const updateTableNumber = useCallback(
    (tableId: string, tableNumber: string) => {
      const clean = tableNumber.trim() || undefined;
      const now = Date.now();
      setTables((prev) =>
        prev.map((t) =>
          t.id === tableId ? { ...t, tableNumber: clean, updatedAt: now } : t
        )
      );
      sendAction({
        type: 'table:updateNumber',
        tableId,
        tableNumber: clean || '',
      });
    },
    [sendAction]
  );

  const addOrder = useCallback(
    (tableId: string, item: OrderItem) => {
      const now = Date.now();
      const enriched: OrderItem = { ...item, addedBy: staffRef.current.name };
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          if (t.orders.some((o) => o.id === enriched.id)) return t;
          return {
            ...t,
            lastCoalCheckAt:
              enriched.category === 'hookah' || enriched.category === 'refill'
                ? now
                : t.lastCoalCheckAt,
            orders: [...t.orders, enriched],
            updatedAt: now,
          };
        })
      );
      sendAction({ type: 'table:addOrder', tableId, item: enriched });
    },
    [sendAction]
  );

  const updateOrderQty = useCallback(
    (tableId: string, orderId: string, delta: number) => {
      const now = Date.now();
      setTables((prev) =>
        prev.map((t) =>
          t.id === tableId
            ? {
                ...t,
                orders: t.orders
                  .map((o) =>
                    o.id === orderId ? { ...o, quantity: o.quantity + delta } : o
                  )
                  .filter((o) => o.quantity > 0),
                updatedAt: now,
              }
            : t
        )
      );
      sendAction({ type: 'table:updateQty', tableId, orderId, delta });
    },
    [sendAction]
  );

  const refreshCoals = useCallback(
    (tableId: string) => {
      const now = Date.now();
      setTables((prev) =>
        prev.map((t) =>
          t.id === tableId ? { ...t, lastCoalCheckAt: now, updatedAt: now } : t
        )
      );
      sendAction({ type: 'table:refreshCoals', tableId });
    },
    [sendAction]
  );

  const advancePrep = useCallback(
    (tableId: string, orderId: string, nextStatus: PrepStatus) => {
      const now = Date.now();
      setTables((prev) =>
        prev.map((t) =>
          t.id === tableId
            ? {
                ...t,
                orders: t.orders.map((o) =>
                  o.id === orderId ? { ...o, prepStatus: nextStatus } : o
                ),
                updatedAt: now,
              }
            : t
        )
      );
      sendAction({ type: 'table:advancePrep', tableId, orderId, nextStatus });
    },
    [sendAction]
  );

  const checkoutTable = useCallback(
    (tableId: string) => {
      const now = Date.now();
      const target = tables.find((t) => t.id === tableId);
      if (target && target.seatedAt) {
        const subtotal = target.orders.reduce(
          (s, o) => s + o.unitPrice * o.quantity,
          0
        );
        const tax = 0;
        const localSess: CompletedSession = {
          id: `sess-${now}-${target.id}`,
          tableName: target.name,
          floor: target.floor,
          zone: target.zone,
          partySize: target.partySize || 1,
          guestName: target.guestName,
          serverName: target.serverName || staffRef.current.name,
          seatedAt: target.seatedAt,
          closedAt: now,
          durationMinutes: Math.max(
            1,
            Math.round((now - target.seatedAt) / 60_000)
          ),
          orders: target.orders,
          subtotal,
          tax,
          total: subtotal,
        };
        setHistory((prev) => [localSess, ...prev]);
      }

      setTables((prev) =>
        prev.map((t) =>
          t.id === tableId
            ? {
                ...t,
                status: 'available',
                seatingTier: undefined,
                timeLimitMinutes: undefined,
                partySize: undefined,
                guestName: undefined,
                serverName: undefined,
                seatedAt: undefined,
                lastCoalCheckAt: undefined,
                orders: [],
                updatedAt: now,
              }
            : t
        )
      );
      sendAction({
        type: 'table:checkout',
        tableId,
        staffName: staffRef.current.name,
      });
    },
    [sendAction, tables]
  );

  const upgradeToVip = useCallback(
    (tableId: string) => {
      const now = Date.now();
      const item: OrderItem = {
        id: `ord-${now}-${Math.random().toString(36).slice(2, 7)}-vip`,
        menuItemId: 'r-upgrade-vip',
        name: 'Upgrade to VIP',
        category: 'refill',
        unitPrice: VIP_UPGRADE_PRICE,
        quantity: 1,
        notes: 'Upgraded One Time to VIP',
        addedBy: staffRef.current.name,
        prepStatus: 'served',
        orderedAt: now,
      };

      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          return {
            ...t,
            seatingTier: 'vip_allday',
            timeLimitMinutes: undefined,
            orders: t.orders.some((o) => o.id === item.id)
              ? t.orders
              : [...t.orders, item],
            updatedAt: now,
          };
        })
      );

      sendAction({
        type: 'table:upgradeVip',
        tableId,
        item,
      });
    },
    [sendAction]
  );

  const updateOrderFlavors = useCallback(
    (tableId: string, orderId: string, nextFlavors: string[]) => {
      const sanitized = nextFlavors
        .map((f) => f.trim())
        .filter(Boolean)
        .slice(0, 3);
      const now = Date.now();
      setTables((prev) =>
        prev.map((t) =>
          t.id === tableId
            ? {
                ...t,
                orders: t.orders.map((o) =>
                  o.id === orderId
                    ? {
                        ...o,
                        flavors: sanitized.length > 0 ? sanitized : undefined,
                      }
                    : o
                ),
                updatedAt: now,
              }
            : t
        )
      );
      sendAction({
        type: 'table:updateOrderFlavors',
        tableId,
        orderId,
        flavors: sanitized,
      });
    },
    [sendAction]
  );

  const addFlavor = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setFlavors((prev) => {
        const existing = prev.find(
          (f) => f.name.toLowerCase() === trimmed.toLowerCase()
        );
        if (existing) {
          return prev.map((f) =>
            f.id === existing.id ? { ...f, available: true } : f
          );
        }
        return [
          ...prev,
          {
            id: `flv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: trimmed,
            available: true,
          },
        ];
      });
      sendAction({ type: 'flavors:add', name: trimmed });
    },
    [sendAction]
  );

  const toggleFlavorAvailability = useCallback(
    (flavorId: string) => {
      setFlavors((prev) =>
        prev.map((f) =>
          f.id === flavorId ? { ...f, available: !f.available } : f
        )
      );
      sendAction({ type: 'flavors:toggle', flavorId });
    },
    [sendAction]
  );

  const removeFlavor = useCallback(
    (flavorId: string) => {
      setFlavors((prev) => prev.filter((f) => f.id !== flavorId));
      sendAction({ type: 'flavors:remove', flavorId });
    },
    [sendAction]
  );

  const moveTable = useCallback(
    (tableId: string, x: number, y: number) => {
      const now = Date.now();
      setTables((prev) =>
        prev.map((t) =>
          t.id === tableId ? { ...t, x, y, updatedAt: now } : t
        )
      );
      sendAction({ type: 'layout:moveTable', tableId, x, y });
    },
    [sendAction]
  );

  const saveTableLayout = useCallback(
    (data: {
      id?: string;
      name: string;
      tableNumber?: string;
      floor: TableFloor;
      zone: TableZone;
      seats: number;
      shape: TableShape;
    }) => {
      sendAction({ type: 'layout:saveTable', data });
    },
    [sendAction]
  );

  const deleteTable = useCallback(
    (tableId: string) => {
      setTables((prev) => prev.filter((t) => t.id !== tableId));
      sendAction({ type: 'layout:deleteTable', tableId });
    },
    [sendAction]
  );

  const updateSettings = useCallback(
    (nextSettings: LoungeSettings) => {
      setSettings(nextSettings);
      sendAction({ type: 'settings:update', settings: nextSettings });
    },
    [sendAction]
  );

  const batchOutShift = useCallback(async (): Promise<BatchReport | null> => {
    const now = Date.now();
    const staffName = staffRef.current.name || 'Manager';

    const autoClosedSessions: CompletedSession[] = tables
      .filter((t) => t.status === 'occupied')
      .map((t) => {
        const seatedAt = t.seatedAt || now;
        const sub = t.orders.reduce((s, o) => s + o.unitPrice * o.quantity, 0);
        const tax = 0;
        return {
          id: `sess-${now}-${t.id}`,
          tableName: t.name,
          floor: t.floor,
          zone: t.zone,
          partySize: t.partySize || 1,
          guestName: t.guestName,
          serverName: t.serverName || staffName,
          seatedAt,
          closedAt: now,
          durationMinutes: Math.max(1, Math.round((now - seatedAt) / 60_000)),
          orders: t.orders,
          subtotal: sub,
          tax,
          total: sub,
        };
      });

    const allDaySessions = [...autoClosedSessions, ...history];
    const subtotal = allDaySessions.reduce((s, x) => s + x.subtotal, 0);
    const tax = allDaySessions.reduce((s, x) => s + x.tax, 0);
    const total = allDaySessions.reduce((s, x) => s + x.total, 0);

    const optimisticReport: BatchReport = {
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

    // Optimistically close every occupied table and reset shift ledger immediately
    setTables((prev) =>
      prev.map((t) =>
        t.status === 'occupied'
          ? {
              ...t,
              status: 'available',
              seatingTier: undefined,
              timeLimitMinutes: undefined,
              partySize: undefined,
              guestName: undefined,
              serverName: undefined,
              seatedAt: undefined,
              lastCoalCheckAt: undefined,
              orders: [],
              updatedAt: now,
            }
          : t
      )
    );
    setHistory([]);
    setLastBatchReport(optimisticReport);

    try {
      const res = await fetch('/api/shift/batch-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffName }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          ok: boolean;
          report?: BatchReport;
          snapshot?: LoungeStateSnapshot;
        };
        if (data.snapshot && Array.isArray(data.snapshot.tables)) {
          setTables(data.snapshot.tables);
          setHistory(data.snapshot.history || []);
          setSettings(data.snapshot.settings || DEFAULT_SETTINGS);
          setActiveStaff(data.snapshot.activeStaff || []);
          setLastBatchReport(data.snapshot.lastBatchReport ?? data.report ?? optimisticReport);
        }
        return data.report ?? optimisticReport;
      }
    } catch {
      // Fall back to WebSocket mutation below
    }

    sendAction({
      type: 'shift:batchOut',
      staffName,
    });
    return optimisticReport;
  }, [tables, history, sendAction]);

  const resetDemo = useCallback(() => {
    sendAction({ type: 'state:resetDemo' });
  }, [sendAction]);

  return {
    tables,
    history,
    settings,
    activeStaff,
    lastBatchReport,
    flavors,
    connectionState,
    seatTable,
    updateTableNumber,
    addOrder,
    updateOrderQty,
    refreshCoals,
    advancePrep,
    checkoutTable,
    upgradeToVip,
    updateOrderFlavors,
    addFlavor,
    toggleFlavorAvailability,
    removeFlavor,
    moveTable,
    saveTableLayout,
    deleteTable,
    updateSettings,
    batchOutShift,
    resetDemo,
  };
}
