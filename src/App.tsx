import { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Crown,
  Flame,
  LayoutGrid,
  Settings2,
  Volume2,
  X,
} from 'lucide-react';
import {
  getTableSeatingTier,
  getVipUpgradeOption,
} from './data/menu';
import { useLoungeSync } from './hooks/useLoungeSync';
import { triggerTimerAlert, unlockAudioEngine } from './services/audioAlerts';
import {
  printViaBluetoothEscPos,
  printViaNetworkEscPos,
} from './services/kitchenPrinter';
import type {
  BatchReport,
  KitchenTicketItem,
  KitchenTicketPayload,
  LoungeTable,
  OrderItem,
  PaymentMethod,
  PrinterPaperWidth,
  SeatingTierId,
  StaffProfile,
  TableFloor,
} from './types';
import { FloorPlanScreen } from './screens/FloorPlanScreen';
import { HookahStationScreen } from './screens/HookahStationScreen';
import { AnalyticsScreen } from './screens/AnalyticsScreen';
import { TableDetailSheet } from './components/TableDetailSheet';
import { TableEditorModal } from './components/TableEditorModal';
import { StaffSettingsModal } from './components/StaffSettingsModal';
import { GoogleDocsExportModal } from './components/GoogleDocsExportModal';
import { BatchOutModal } from './components/BatchOutModal';
import { FlavorManagerModal } from './components/FlavorManagerModal';
import { KitchenPrintModal } from './components/KitchenPrintModal';
import { ThermalReceiptPrintView } from './components/ThermalReceiptPrintView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { triggerHaptic, useAndroidWakeLock } from './hooks/useAndroidWakeLock';

type Tab = 'tables' | 'station' | 'analytics';

const STAFF_STORAGE_KEY = 'emberpos_staff_profile_v1';

function loadInitialStaff(): StaffProfile {
  try {
    const raw = localStorage.getItem(STAFF_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StaffProfile>;
      if (parsed.clientId && parsed.name) {
        return {
          clientId: parsed.clientId,
          name: parsed.name,
          role: parsed.role || 'Server',
          alertMode: parsed.alertMode || 'chime_voice',
        };
      }
    }
  } catch {
    // Fallback below
  }
  return {
    clientId: `staff-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Server 1',
    role: 'Server',
    alertMode: 'chime_voice',
  };
}

interface ActiveAlertBanner {
  id: string;
  tableId: string;
  title: string;
  kind: 'longstay' | 'expiring' | 'order';
}

export default function App() {
  const [tab, setTab] = useState<Tab>('tables');
  const [selectedFloor, setSelectedFloor] = useState<TableFloor>('Floor 1');
  const [staff, setStaff] = useState<StaffProfile>(loadInitialStaff);

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [editingTable, setEditingTable] = useState<LoungeTable | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportDocsOpen, setIsExportDocsOpen] = useState(false);
  const [exportBatchTarget, setExportBatchTarget] = useState<BatchReport | null>(
    null
  );
  const [isBatchOutOpen, setIsBatchOutOpen] = useState(false);
  const [isFlavorManagerOpen, setIsFlavorManagerOpen] = useState(false);
  const [kitchenPrintTicket, setKitchenPrintTicket] =
    useState<KitchenTicketPayload | null>(null);
  const [kitchenPrintMeta, setKitchenPrintMeta] = useState<{
    tableId: string;
    orderIds: string[];
  } | null>(null);
  const [isKitchenPrintOpen, setIsKitchenPrintOpen] = useState(false);
  const [systemPrintTicket, setSystemPrintTicket] =
    useState<KitchenTicketPayload | null>(null);
  const [systemPrintWidth, setSystemPrintWidth] =
    useState<PrinterPaperWidth>('80mm');
  const [alertBanner, setAlertBanner] = useState<ActiveAlertBanner | null>(null);

  const {
    tables,
    history,
    settings,
    activeStaff,
    lastBatchReport,
    flavors,
    connectionState,
    seatTable,
    addOrder,
    updateOrderQty,
    advancePrep,
    checkoutTable,
    transferTable,
    markOrdersPrinted,
    upgradeToVip,
    updateOrderFlavors,
    updateTableNumber,
    updatePartySize,
    addFlavor,
    toggleFlavorAvailability,
    removeFlavor,
    moveTable,
    saveTableLayout,
    deleteTable,
    updateSettings,
    batchOutShift,
    resetDemo,
  } = useLoungeSync(staff);

  const wakeLock = useAndroidWakeLock();

  const lastStayAlertRef = useRef<Record<string, number>>({});
  const lastWarningAlertRef = useRef<Record<string, number>>({});
  const prevQueuedCountRef = useRef<number | null>(null);

  // Persist local staff identity & audio preference
  useEffect(() => {
    try {
      localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(staff));
    } catch {
      // Ignore storage quota errors
    }
  }, [staff]);

  // Unlock browser Web Audio engine on first user pointer interaction
  useEffect(() => {
    const unlock = () => {
      unlockAudioEngine().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  // Live timer audio alert monitor (Long stay & 15m expiry warnings)
  useEffect(() => {
    const checkTimers = () => {
      const now = Date.now();
      for (const table of tables) {
        if (table.status !== 'occupied' || !table.seatedAt) continue;

        const stayMins = (now - table.seatedAt) / 60_000;
        const stayLimit = table.timeLimitMinutes ?? settings.longStayAlertMinutes;
        if (
          table.timeLimitMinutes &&
          stayMins >= table.timeLimitMinutes - 15 &&
          stayMins < table.timeLimitMinutes &&
          !lastWarningAlertRef.current[table.id]
        ) {
          lastWarningAlertRef.current[table.id] = now;
          const minsLeft = Math.max(
            1,
            Math.ceil(table.timeLimitMinutes - stayMins)
          );
          const msg = `${table.floor}, ${
            table.tableNumber ? `#${table.tableNumber} ${table.name}` : table.name
          } has ${minsLeft}m left before 2h limit`;
          triggerTimerAlert('longstay', msg, staff.alertMode);
          setAlertBanner({
            id: `warn-${table.id}-${now}`,
            tableId: table.id,
            title: msg,
            kind: 'expiring',
          });
          break;
        }

        if (
          stayMins >= stayLimit &&
          !lastStayAlertRef.current[table.id]
        ) {
          lastStayAlertRef.current[table.id] = now;
          const msg = table.timeLimitMinutes
            ? `${table.floor}, ${table.name} reached ${Math.round(stayLimit / 60)}h limit`
            : `${table.floor}, ${table.name} reached ${stayLimit} minutes`;
          triggerTimerAlert('longstay', msg, staff.alertMode);
          setAlertBanner({
            id: `stay-${table.id}-${now}`,
            tableId: table.id,
            title: msg,
            kind: 'longstay',
          });
          break;
        }
      }
    };

    const timerId = setInterval(checkTimers, 5000);
    return () => clearInterval(timerId);
  }, [tables, settings, staff.alertMode]);

  // Audio ping when new queued hookah orders arrive on Hookah Station devices
  const queuedCount = tables.reduce(
    (sum, t) => sum + t.orders.filter((o) => o.prepStatus === 'queued').length,
    0
  );

  useEffect(() => {
    if (
      prevQueuedCountRef.current !== null &&
      queuedCount > prevQueuedCountRef.current &&
      staff.role === 'Hookah Master'
    ) {
      triggerTimerAlert('order', 'New hookah order received', staff.alertMode);
      setAlertBanner({
        id: `order-${Date.now()}`,
        tableId: '',
        title: 'New hookah order queued at Station',
        kind: 'order',
      });
    }
    prevQueuedCountRef.current = queuedCount;
  }, [queuedCount, staff.role, staff.alertMode]);

  const buildKitchenTicket = (
    table: LoungeTable,
    specificOrders?: OrderItem[]
  ): KitchenTicketPayload => {
    const sourceOrders =
      specificOrders && specificOrders.length > 0
        ? specificOrders
        : (() => {
            const prepOrders = table.orders.filter(
              (o) =>
                o.category === 'hookah' ||
                o.menuItemId === 'r1' ||
                o.menuItemId === 'r-ice' ||
                o.menuItemId === 'r2'
            );
            return prepOrders.length > 0 ? prepOrders : table.orders;
          })();

    const items: KitchenTicketItem[] =
      sourceOrders.length > 0
        ? sourceOrders.map((o) => ({
            name: o.name,
            quantity: o.quantity,
            flavors: o.flavors,
            iceHose: o.iceHose,
            notes: o.notes,
          }))
        : [
            {
              name: 'Hookah Prep',
              quantity: 1,
            },
          ];

    return {
      tableId: table.id,
      tableNumber: table.tableNumber || table.name,
      tableName: table.name,
      floor: table.floor,
      zone: table.zone,
      guestName: table.guestName,
      serverName: table.serverName || staff.name,
      printedAt: Date.now(),
      items,
    };
  };

  const getPrintableOrders = (
    table: LoungeTable,
    specificOrders?: OrderItem[]
  ): OrderItem[] => {
    if (specificOrders && specificOrders.length > 0) return specificOrders;
    const prepOrders = table.orders.filter(
      (o) =>
        o.category === 'hookah' ||
        o.menuItemId === 'r1' ||
        o.menuItemId === 'r-ice' ||
        o.menuItemId === 'r2'
    );
    return prepOrders.length > 0 ? prepOrders : table.orders;
  };

  const openKitchenPrint = (
    table: LoungeTable,
    specificOrders?: OrderItem[]
  ) => {
    const targetOrders = getPrintableOrders(table, specificOrders);
    setKitchenPrintMeta({
      tableId: table.id,
      orderIds: targetOrders.map((o) => o.id),
    });
    setKitchenPrintTicket(buildKitchenTicket(table, specificOrders));
    setIsKitchenPrintOpen(true);
  };

  const handleQuickPrint = async (
    table: LoungeTable,
    specificOrders?: OrderItem[]
  ) => {
    const targetOrders = getPrintableOrders(table, specificOrders);
    const orderIds = targetOrders.map((o) => o.id);
    const ticket = buildKitchenTicket(table, specificOrders);
    const mode = settings.kitchenPrinterMode || 'system';
    const width = settings.kitchenPrinterWidth || '80mm';

    if (mode === 'network') {
      if (!settings.kitchenPrinterIp) {
        openKitchenPrint(table, specificOrders);
        return;
      }
      const res = await printViaNetworkEscPos(
        ticket,
        settings.kitchenPrinterIp,
        settings.kitchenPrinterPort || 9100,
        width
      );
      if (res.ok) {
        triggerHaptic(12);
        if (orderIds.length > 0) markOrdersPrinted(table.id, orderIds);
      } else {
        openKitchenPrint(table, specificOrders);
      }
      return;
    }

    if (mode === 'bluetooth') {
      const res = await printViaBluetoothEscPos(ticket, width);
      if (res.ok) {
        triggerHaptic(12);
        if (orderIds.length > 0) markOrdersPrinted(table.id, orderIds);
      } else {
        openKitchenPrint(table, specificOrders);
      }
      return;
    }

    handleSystemPrint(ticket, width);
    if (orderIds.length > 0) markOrdersPrinted(table.id, orderIds);
  };

  const handleSystemPrint = (
    ticket: KitchenTicketPayload,
    width: PrinterPaperWidth
  ) => {
    setSystemPrintTicket(ticket);
    setSystemPrintWidth(width);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
  };

  const maybeAutoPrintLan = (
    table: LoungeTable,
    orders: OrderItem[]
  ) => {
    if (
      !settings.autoPrintKitchenTicket ||
      settings.kitchenPrinterMode !== 'network' ||
      !settings.kitchenPrinterIp
    ) {
      return;
    }
    const prepOrders = orders.filter(
      (o) =>
        o.category === 'hookah' ||
        o.menuItemId === 'r1' ||
        o.menuItemId === 'r-ice' ||
        o.menuItemId === 'r2'
    );
    if (prepOrders.length === 0) return;

    const ticket = buildKitchenTicket(table, prepOrders);
    printViaNetworkEscPos(
      ticket,
      settings.kitchenPrinterIp,
      settings.kitchenPrinterPort || 9100,
      settings.kitchenPrinterWidth || '80mm'
    )
      .then((res) => {
        if (res.ok) {
          markOrdersPrinted(
            table.id,
            prepOrders.map((o) => o.id)
          );
        }
      })
      .catch(() => {});
  };

  const handleSeatTable = (
    tableId: string,
    partySize: number,
    guestName: string,
    initialOrders?: OrderItem[],
    seatingTier?: SeatingTierId,
    timeLimitMinutes?: number,
    tableNumber?: string
  ) => {
    triggerHaptic(14);
    delete lastStayAlertRef.current[tableId];
    delete lastWarningAlertRef.current[tableId];
    seatTable(
      tableId,
      partySize,
      guestName,
      initialOrders,
      seatingTier,
      timeLimitMinutes,
      tableNumber
    );
    const targetTable = tables.find((t) => t.id === tableId);
    if (targetTable && initialOrders && initialOrders.length > 0) {
      maybeAutoPrintLan(
        {
          ...targetTable,
          guestName: guestName || undefined,
          tableNumber: tableNumber ?? targetTable.tableNumber,
          serverName: staff.name,
        },
        initialOrders
      );
    }
  };

  const handleAddOrder = (tableId: string, item: OrderItem) => {
    triggerHaptic(10);
    addOrder(tableId, item);
    const targetTable = tables.find((t) => t.id === tableId);
    if (targetTable) {
      maybeAutoPrintLan(targetTable, [item]);
    }
  };

  const handleCheckoutTable = (
    tableId: string,
    payment?: {
      paymentMethod?: PaymentMethod;
      cashPaid?: number;
      cardPaid?: number;
      splitWays?: number;
    }
  ) => {
    triggerHaptic(20);
    delete lastStayAlertRef.current[tableId];
    delete lastWarningAlertRef.current[tableId];
    if (alertBanner?.tableId === tableId) {
      setAlertBanner(null);
    }
    checkoutTable(tableId, payment);
  };

  const handleUpgradeToVip = (tableId: string) => {
    triggerHaptic(18);
    delete lastStayAlertRef.current[tableId];
    delete lastWarningAlertRef.current[tableId];
    if (
      alertBanner?.tableId === tableId &&
      (alertBanner.kind === 'longstay' || alertBanner.kind === 'expiring')
    ) {
      setAlertBanner(null);
    }
    upgradeToVip(tableId);
  };

  const handleBatchOutShift = async () => {
    triggerHaptic(24);
    lastStayAlertRef.current = {};
    lastWarningAlertRef.current = {};
    setAlertBanner(null);
    setSelectedTableId(null);
    return batchOutShift();
  };

  const selectedTable = tables.find((t) => t.id === selectedTableId) || null;
  const activeStationCount = tables.reduce(
    (sum, t) => sum + t.orders.filter((o) => o.prepStatus !== 'served').length,
    0
  );

  return (
    <>
      <div className="min-h-screen bg-transparent text-slate-100 pb-16 md:pb-8">
      {/* 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 pt-safe border-b border-cyan-500/20 bg-[#05070E]/90 backdrop-blur-md">
        <div className="mx-auto flex h-11 md:h-14 max-w-7xl items-center justify-between gap-2 sm:gap-8 px-3 sm:px-6">
          <button
            type="button"
            onClick={() => setTab('tables')}
            className="inline-flex items-center gap-1.5 text-base md:text-lg font-bold tracking-wider text-cyan-300 whitespace-nowrap shrink-0 font-display drop-shadow-[0_0_10px_rgba(34,211,238,0.45)]"
          >
            <span className="h-2 w-2 md:h-2.5 md:w-2.5 rotate-45 bg-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.9)]" />
            SIN-OS
          </button>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-6 text-sm font-semibold"
          >
            <button
              type="button"
              onClick={() => setTab('tables')}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 font-display tracking-wide ${
                tab === 'tables'
                  ? 'border-cyan-400 text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.45)]'
                  : 'border-transparent text-slate-400 hover:text-cyan-200'
              }`}
            >
              Floor Plan
            </button>
            <button
              type="button"
              onClick={() => setTab('station')}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 font-display tracking-wide ${
                tab === 'station'
                  ? 'border-cyan-400 text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.45)]'
                  : 'border-transparent text-slate-400 hover:text-cyan-200'
              }`}
            >
              Hookah Station{activeStationCount > 0 ? ` (${activeStationCount})` : ''}
            </button>
            <button
              type="button"
              onClick={() => setTab('analytics')}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 font-display tracking-wide ${
                tab === 'analytics'
                  ? 'border-cyan-400 text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.45)]'
                  : 'border-transparent text-slate-400 hover:text-cyan-200'
              }`}
            >
              Shift Report
            </button>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <PWAInstallButton variant="header" />
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="inline-flex min-h-[32px] md:min-h-[40px] items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-[#0B101D] px-2.5 sm:px-3 py-1 text-[11px] md:text-xs font-semibold text-cyan-100 transition-colors hover:border-cyan-400/70 hover:bg-[#11192D] whitespace-nowrap shrink-0"
            >
              <Settings2 className="h-3.5 w-3.5 text-cyan-400" />
              <span className="max-w-[76px] sm:max-w-[110px] truncate">{staff.name}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="mx-auto max-w-7xl px-3 sm:px-6 pt-2.5 sm:pt-5">
        {alertBanner && (
          <div
            className={`mb-2.5 sm:mb-4 flex flex-wrap items-center justify-between gap-2 sm:gap-3 rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm ${
              alertBanner.kind === 'longstay'
                ? 'border-fuchsia-500/50 bg-fuchsia-500/10 cyber-glow-magenta'
                : alertBanner.kind === 'order'
                ? 'border-cyan-400/50 bg-cyan-500/10 cyber-glow-cyan'
                : 'border-amber-400/50 bg-amber-500/10'
            }`}
          >
            <div
              className={`flex items-center gap-2.5 ${
                alertBanner.kind === 'longstay'
                  ? 'text-fuchsia-200'
                  : alertBanner.kind === 'order'
                  ? 'text-cyan-200'
                  : 'text-amber-200'
              }`}
            >
              <Volume2
                className={`h-4 w-4 shrink-0 ${
                  alertBanner.kind === 'longstay'
                    ? 'text-fuchsia-400'
                    : alertBanner.kind === 'order'
                    ? 'text-cyan-400'
                    : 'text-amber-400'
                }`}
              />
              <span className="font-semibold">{alertBanner.title}</span>
            </div>
            <div className="flex items-center gap-2">
              {(alertBanner.kind === 'longstay' ||
                alertBanner.kind === 'expiring') &&
                alertBanner.tableId &&
                (() => {
                  const bannerTable = tables.find(
                    (t) => t.id === alertBanner.tableId
                  );
                  const upgradeOpt = bannerTable
                    ? getVipUpgradeOption(getTableSeatingTier(bannerTable).id)
                    : null;
                  return upgradeOpt ? (
                    <button
                      type="button"
                      onClick={() => handleUpgradeToVip(alertBanner.tableId)}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-fuchsia-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-fuchsia-400 whitespace-nowrap"
                    >
                      <Crown className="h-3.5 w-3.5" />
                      {upgradeOpt.shortLabel} +${upgradeOpt.price}
                    </button>
                  ) : null;
                })()}
              <button
                type="button"
                onClick={() => setAlertBanner(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800/80 hover:text-slate-100"
                aria-label="Dismiss alert"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {tab === 'tables' && (
          <FloorPlanScreen
            tables={tables}
            settings={settings}
            selectedFloor={selectedFloor}
            onChangeFloor={setSelectedFloor}
            onSelectTable={(t) => setSelectedTableId(t.id)}
            onEditTable={(t) => {
              setEditingTable(t);
              setIsEditorOpen(true);
            }}
            onAddNewTable={() => {
              setEditingTable(null);
              setIsEditorOpen(true);
            }}
            onMoveTable={moveTable}
          />
        )}

        {tab === 'station' && (
          <HookahStationScreen
            tables={tables}
            onAdvancePrep={advancePrep}
            onOpenFlavorManager={() => setIsFlavorManagerOpen(true)}
            onPrintOrder={(table, order) => openKitchenPrint(table, [order])}
            onQuickPrintOrder={(table, order) => handleQuickPrint(table, [order])}
          />
        )}

        {tab === 'analytics' && (
          <AnalyticsScreen
            tables={tables}
            history={history}
            lastBatchReport={lastBatchReport}
            onOpenExportDocs={(batch) => {
              setExportBatchTarget(batch ?? null);
              setIsExportDocsOpen(true);
            }}
            onOpenBatchOut={() => setIsBatchOutOpen(true)}
          />
        )}
      </main>

      {/* Mobile Bottom Thumb-Zone Navigation */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 grid min-h-[48px] pb-safe grid-cols-3 border-t border-cyan-500/20 bg-[#070A15]/95 backdrop-blur-md"
      >
        <button
          type="button"
          onClick={() => {
            triggerHaptic(8);
            setTab('tables');
          }}
          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-semibold font-display tracking-wide ${
            tab === 'tables' ? 'text-cyan-300' : 'text-slate-400'
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
          <span>Tables</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic(8);
            setTab('station');
          }}
          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-semibold font-display tracking-wide ${
            tab === 'station' ? 'text-cyan-300' : 'text-slate-400'
          }`}
        >
          <Flame className="h-4 w-4" />
          <span>
            Station{activeStationCount > 0 ? ` (${activeStationCount})` : ''}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic(8);
            setTab('analytics');
          }}
          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-semibold font-display tracking-wide ${
            tab === 'analytics' ? 'text-cyan-300' : 'text-slate-400'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          <span>Shift</span>
        </button>
      </nav>

      <OfflineIndicator />

      {/* Modals & Sheets */}
      <TableDetailSheet
        table={selectedTable}
        allTables={tables}
        settings={settings}
        flavors={flavors}
        onClose={() => setSelectedTableId(null)}
        onSeatTable={handleSeatTable}
        onAddOrder={handleAddOrder}
        onUpdateQty={updateOrderQty}
        onUpdateOrderFlavors={updateOrderFlavors}
        onUpdateTableNumber={updateTableNumber}
        onUpdatePartySize={updatePartySize}
        onPrintKitchenTicket={openKitchenPrint}
        onQuickPrintKitchenTicket={handleQuickPrint}
        onCheckoutTable={handleCheckoutTable}
        onTransferTable={(fromId, toId, upgrade) => {
          triggerHaptic(16);
          transferTable(fromId, toId, upgrade);
          setSelectedTableId(toId);
        }}
        onUpgradeToVip={handleUpgradeToVip}
        onOpenFlavorManager={() => setIsFlavorManagerOpen(true)}
      />

      <TableEditorModal
        visible={isEditorOpen}
        table={editingTable}
        defaultFloor={selectedFloor}
        onClose={() => setIsEditorOpen(false)}
        onSave={(data) => {
          saveTableLayout(data);
          setSelectedFloor(data.floor);
        }}
        onDelete={deleteTable}
      />

      <StaffSettingsModal
        visible={isSettingsOpen}
        profile={staff}
        settings={settings}
        activeStaff={activeStaff}
        connectionState={connectionState}
        wakeLockSupported={wakeLock.supported}
        wakeLockEnabled={wakeLock.enabled}
        wakeLockActive={wakeLock.active}
        onToggleWakeLock={wakeLock.setEnabled}
        onClose={() => setIsSettingsOpen(false)}
        onSaveProfile={setStaff}
        onUpdateSettings={updateSettings}
        onResetDemo={resetDemo}
        onOpenFlavorManager={() => setIsFlavorManagerOpen(true)}
      />

      <GoogleDocsExportModal
        visible={isExportDocsOpen}
        tables={tables}
        history={history}
        staffName={staff.name}
        batchReport={exportBatchTarget}
        onClose={() => setIsExportDocsOpen(false)}
      />

      <BatchOutModal
        visible={isBatchOutOpen}
        tables={tables}
        history={history}
        staffName={staff.name}
        onClose={() => setIsBatchOutOpen(false)}
        onConfirmBatchOut={handleBatchOutShift}
      />

      <FlavorManagerModal
        visible={isFlavorManagerOpen}
        flavors={flavors}
        onClose={() => setIsFlavorManagerOpen(false)}
        onAddFlavor={addFlavor}
        onToggleAvailability={toggleFlavorAvailability}
        onRemoveFlavor={removeFlavor}
      />

      <KitchenPrintModal
        visible={isKitchenPrintOpen}
        ticket={kitchenPrintTicket}
        settings={settings}
        onClose={() => setIsKitchenPrintOpen(false)}
        onUpdateSettings={updateSettings}
        onSaveTableNumber={updateTableNumber}
        onSystemPrint={handleSystemPrint}
        onPrinted={() => {
          if (kitchenPrintMeta && kitchenPrintMeta.orderIds.length > 0) {
            markOrdersPrinted(
              kitchenPrintMeta.tableId,
              kitchenPrintMeta.orderIds
            );
          }
        }}
      />
      </div>
      <ThermalReceiptPrintView
        ticket={systemPrintTicket}
        paperWidth={systemPrintWidth}
      />
    </>
  );
}
