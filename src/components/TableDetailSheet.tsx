import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Crown,
  Flame,
  Minus,
  Pencil,
  Play,
  Plus,
  Printer,
  Receipt,
  Snowflake,
  Sparkles,
  X,
} from 'lucide-react';
import {
  MENU_ITEMS,
  SEATING_TIERS,
  SEATING_TIER_LIST,
  VIP_UPGRADE_PRICE,
  getTableSeatingTier,
} from '../data/menu';
import type {
  FlavorOption,
  LoungeSettings,
  LoungeTable,
  MenuCategory,
  MenuItem,
  OrderItem,
  SeatingTierId,
} from '../types';
import { TimerDisplay } from './TimerDisplay';

interface TableDetailSheetProps {
  table: LoungeTable | null;
  settings: LoungeSettings;
  flavors: FlavorOption[];
  onClose: () => void;
  onSeatTable: (
    tableId: string,
    partySize: number,
    guestName: string,
    initialOrders?: OrderItem[],
    seatingTier?: SeatingTierId,
    timeLimitMinutes?: number,
    tableNumber?: string
  ) => void;
  onAddOrder: (tableId: string, item: OrderItem) => void;
  onUpdateQty: (tableId: string, orderId: string, delta: number) => void;
  onUpdateOrderFlavors: (tableId: string, orderId: string, flavors: string[]) => void;
  onUpdateTableNumber: (tableId: string, tableNumber: string) => void;
  onPrintKitchenTicket: (table: LoungeTable, orders?: OrderItem[]) => void;
  onRefreshCoals: (tableId: string) => void;
  onCheckoutTable: (tableId: string) => void;
  onUpgradeToVip: (tableId: string) => void;
  onOpenFlavorManager: () => void;
}

export const TableDetailSheet: React.FC<TableDetailSheetProps> = ({
  table,
  settings,
  flavors,
  onClose,
  onSeatTable,
  onAddOrder,
  onUpdateQty,
  onUpdateOrderFlavors,
  onUpdateTableNumber,
  onPrintKitchenTicket,
  onRefreshCoals,
  onCheckoutTable,
  onUpgradeToVip,
  onOpenFlavorManager,
}) => {
  const [guestName, setGuestName] = useState('');
  const [seatTableNumber, setSeatTableNumber] = useState('');
  const [isEditingTableNum, setIsEditingTableNum] = useState(false);
  const [tableNumDraft, setTableNumDraft] = useState('');
  const [seatingTier, setSeatingTier] = useState<SeatingTierId>('downstairs');
  const [extraPeopleCount, setExtraPeopleCount] = useState(0);
  const [addExtraCount, setAddExtraCount] = useState(1);
  const [seatIceHose, setSeatIceHose] = useState(false);
  const [seatUpgradeVip, setSeatUpgradeVip] = useState(false);
  const [seatFlavors, setSeatFlavors] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<MenuCategory>('hookah');
  const [confirmCheckout, setConfirmCheckout] = useState(false);

  // Hookah Mix Builder State
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [iceHose, setIceHose] = useState(false);
  const [hookahNotes, setHookahNotes] = useState('');

  // Edit Existing Order Flavors State
  const [editingOrderForFlavors, setEditingOrderForFlavors] =
    useState<OrderItem | null>(null);
  const [editingFlavorsDraft, setEditingFlavorsDraft] = useState<string[]>([]);

  useEffect(() => {
    const defaultTier: SeatingTierId =
      table?.zone === 'Bar'
        ? 'bar_onetime'
        : table?.zone === 'VIP'
        ? 'vip_onetime'
        : 'downstairs';
    setExtraPeopleCount(0);
    setAddExtraCount(1);
    setGuestName('');
    setSeatTableNumber(table?.tableNumber || '');
    setIsEditingTableNum(false);
    setTableNumDraft(table?.tableNumber || '');
    setSeatingTier(defaultTier);
    setSeatIceHose(false);
    setSeatUpgradeVip(false);
    setSeatFlavors([]);
    setConfirmCheckout(false);
    setCustomizingItem(null);
    setEditingOrderForFlavors(null);
    setEditingFlavorsDraft([]);
  }, [table?.id, table?.zone]);

  useEffect(() => {
    setTableNumDraft(table?.tableNumber || '');
    setSeatTableNumber(table?.tableNumber || '');
  }, [table?.id, table?.tableNumber]);

  const totals = useMemo(() => {
    if (!table) return { total: 0 };
    const total = table.orders.reduce(
      (sum, o) => sum + o.unitPrice * o.quantity,
      0
    );
    return { total };
  }, [table]);

  if (!table) return null;

  const activeTier = getTableSeatingTier(table);

  const toggleFlavorInList = (
    flavor: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) => {
      if (prev.includes(flavor)) return prev.filter((f) => f !== flavor);
      if (prev.length >= 3) return prev;
      return [...prev, flavor];
    });
  };

  const renderFlavorPickerGrid = (
    selected: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {flavors.map((flv) => {
        const active = selected.includes(flv.name);
        const disabled = !flv.available && !active;
        return (
          <button
            key={flv.id}
            type="button"
            disabled={disabled}
            onClick={() => toggleFlavorInList(flv.name, setter)}
            className={`flex min-h-[44px] items-center justify-between gap-1.5 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
              active
                ? 'border-fuchsia-400 bg-fuchsia-500/15 text-fuchsia-200'
                : !flv.available
                ? 'border-amber-500/20 bg-[#060913]/60 text-slate-500 cursor-not-allowed'
                : 'border-cyan-500/20 bg-[#060913] text-slate-300 hover:border-cyan-400/50'
            }`}
          >
            <span className={`truncate ${!flv.available ? 'line-through' : ''}`}>
              {flv.name}
            </span>
            {active ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-fuchsia-400" />
            ) : !flv.available ? (
              <span className="shrink-0 text-[9px] font-mono uppercase text-amber-400/90">
                Out
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );

  const getEffectiveMenuPrice = (item: MenuItem): number => {
    if (item.id === 'r1') return activeTier.refillPrice;
    if (item.id === 'r-ice') return activeTier.iceHosePrice;
    return item.price;
  };

  const handleSelectMenuItem = (item: MenuItem) => {
    if (item.id === 'r-upgrade-vip') {
      onUpgradeToVip(table.id);
      return;
    }

    const effectivePrice = getEffectiveMenuPrice(item);
    if (item.category === 'hookah' || item.id === 'r1') {
      const firstAvail = flavors.find((f) => f.available)?.name;
      setCustomizingItem({ ...item, price: effectivePrice });
      setSelectedFlavors(firstAvail ? [firstAvail] : []);
      setIceHose(false);
      setHookahNotes('');
      return;
    }

    const needsHookahPrep = item.id === 'r-ice' || item.id === 'r2';

    onAddOrder(table.id, {
      id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      menuItemId: item.id,
      name: item.name,
      category: item.category,
      unitPrice: effectivePrice,
      quantity: 1,
      prepStatus: needsHookahPrep ? 'queued' : 'served',
      orderedAt: Date.now(),
    });
  };

  const confirmHookahOrder = () => {
    if (!customizingItem) return;
    const flavors =
      selectedFlavors.length > 0 ? selectedFlavors : ['House Mix'];
    const extraIce = iceHose ? activeTier.iceHosePrice : 0;

    onAddOrder(table.id, {
      id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      menuItemId: customizingItem.id,
      name: customizingItem.name,
      category: customizingItem.category,
      unitPrice: customizingItem.price + extraIce,
      quantity: 1,
      flavors,
      iceHose,
      notes: hookahNotes.trim() || undefined,
      prepStatus: 'queued',
      orderedAt: Date.now(),
    });
    setCustomizingItem(null);
  };

  const handleCheckout = () => {
    if (!confirmCheckout) {
      setConfirmCheckout(true);
      return;
    }
    onCheckoutTable(table.id);
    setConfirmCheckout(false);
    onClose();
  };

  const filteredMenu = MENU_ITEMS.filter((m) => {
    if (m.category !== activeCategory) return false;
    if (m.id === 'r-upgrade-vip' && activeTier.id === 'vip_allday') return false;
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] md:max-h-full w-full md:max-w-lg flex-col rounded-t-3xl md:rounded-none md:border-l border-cyan-500/25 bg-[#0A0F1C] shadow-[0_0_40px_rgba(6,182,212,0.16)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-cyan-500/40 md:hidden" />

        {/* Sheet Header */}
        <div className="flex items-start justify-between gap-4 border-b border-cyan-500/20 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              {table.tableNumber && (
                <span className="shrink-0 rounded-md border border-cyan-400/50 bg-cyan-500/15 px-2 py-0.5 font-mono text-xs font-bold text-cyan-300">
                  #{table.tableNumber}
                </span>
              )}
              <h2 className="text-xl font-bold text-slate-100 truncate font-display tracking-wide">
                {table.name}
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-cyan-200/70">
              {table.floor} · {table.zone} · {table.seats} seats
              {table.status === 'occupied' && table.serverName
                ? ` · Server: ${table.serverName}`
                : ''}
            </p>
            {table.status === 'occupied' && table.seatedAt && (
              <div className="mt-2">
                <TimerDisplay
                  seatedAt={table.seatedAt}
                  lastCoalCheckAt={table.lastCoalCheckAt}
                  coalAlertMinutes={settings.coalAlertMinutes}
                  longStayAlertMinutes={settings.longStayAlertMinutes}
                  timeLimitMinutes={
                    table.timeLimitMinutes ?? activeTier.timeLimitMinutes
                  }
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-cyan-500/25 bg-[#060913] text-slate-300 hover:border-cyan-400 hover:text-cyan-200"
            aria-label="Close table details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sheet Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {table.status === 'available' ? (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  Seat New Party
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Base seating includes up to 4 guests (or 1 guest at Bar Top). Starts live timers across all staff devices.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label
                    htmlFor="seat-table-number"
                    className="block text-xs font-medium text-cyan-200/80 mb-1.5"
                  >
                    Table #
                  </label>
                  <input
                    id="seat-table-number"
                    type="text"
                    value={seatTableNumber}
                    onChange={(e) => setSeatTableNumber(e.target.value)}
                    placeholder="e.g. 12"
                    className="w-full min-h-[44px] rounded-xl border border-cyan-500/25 bg-[#060913] px-3.5 py-2.5 font-mono text-sm font-bold text-cyan-200 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor="seat-guest-name"
                    className="block text-xs font-medium text-cyan-200/80 mb-1.5"
                  >
                    Guest or Tab Name (optional)
                  </label>
                  <input
                    id="seat-guest-name"
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="e.g. Alex / Birthday"
                    className="w-full min-h-[44px] rounded-xl border border-cyan-500/25 bg-[#060913] px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-cyan-200/80 mb-2">
                  Seating Options
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SEATING_TIER_LIST.map((tier, idx) => {
                    const active = seatingTier === tier.id;
                    const isLastFull =
                      idx === SEATING_TIER_LIST.length - 1 &&
                      SEATING_TIER_LIST.length % 2 === 1;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => {
                          setSeatingTier(tier.id);
                          if (tier.perPersonService) {
                            setExtraPeopleCount(0);
                          }
                          if (tier.id !== 'vip_onetime' && tier.id !== 'bar_onetime') {
                            setSeatUpgradeVip(false);
                          }
                        }}
                        className={`flex min-h-[72px] flex-col justify-between rounded-xl border p-3 text-left transition-colors ${
                          isLastFull ? 'sm:col-span-2' : ''
                        } ${
                          active
                            ? 'border-cyan-400 bg-cyan-400/15 text-cyan-100 cyber-glow-cyan'
                            : 'border-cyan-500/20 bg-[#060913] text-slate-200 hover:border-cyan-400/50'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className="text-sm font-bold font-display">
                            {tier.label}
                          </span>
                          <span className="font-mono text-sm font-bold text-cyan-300 shrink-0">
                            ${tier.basePrice}
                          </span>
                        </div>
                        <span className="mt-1 text-[11px] text-slate-400">
                          {tier.summary}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {(() => {
                const chosen = SEATING_TIERS[seatingTier];
                const isOneTimeTier =
                  chosen.id === 'vip_onetime' || chosen.id === 'bar_onetime';
                const upgradeVipApplied = isOneTimeTier && seatUpgradeVip;
                const extraPeople = chosen.perPersonService ? 0 : extraPeopleCount;
                const computedPartySize = chosen.perPersonService
                  ? 1
                  : chosen.includedPeople + extraPeople;
                const baseTabPrice = chosen.basePrice;
                const extraTotal = extraPeople * chosen.extraPersonPrice;
                const iceTotal = seatIceHose ? chosen.iceHosePrice : 0;
                const upgradeTotal = upgradeVipApplied ? VIP_UPGRADE_PRICE : 0;
                const openingTotal =
                  baseTabPrice + extraTotal + iceTotal + upgradeTotal;

                return (
                  <>
                    {!chosen.perPersonService && (
                      <div className="rounded-xl border border-cyan-500/25 bg-[#060913] px-3.5 py-3">
                        <label
                          htmlFor="seat-extra-people"
                          className="block text-xs font-medium text-cyan-200 mb-1.5"
                        >
                          Add Extra People — {chosen.label} ($
                          {chosen.extraPersonPrice} each)
                        </label>
                        <select
                          id="seat-extra-people"
                          value={extraPeopleCount}
                          onChange={(e) =>
                            setExtraPeopleCount(Number(e.target.value) || 0)
                          }
                          className="w-full min-h-[44px] rounded-xl border border-cyan-500/30 bg-[#0B101D] px-3 py-2 text-sm font-semibold text-slate-100 focus:border-cyan-400 focus:outline-none"
                        >
                          {Array.from({ length: 13 }, (_, count) => (
                            <option key={count} value={count}>
                              {count === 0
                                ? `0 extra people (Base ${chosen.includedPeople} ppl · +$0)`
                                : `${count} extra ${
                                    count === 1 ? 'person' : 'people'
                                  } × $${chosen.extraPersonPrice} (+$${
                                    count * chosen.extraPersonPrice
                                  })`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="rounded-xl border border-cyan-500/20 bg-[#060913] px-3.5 py-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-slate-300">
                        <span>
                          {chosen.perPersonService
                            ? `${chosen.label} (Single person)`
                            : `${chosen.label} (Base ${chosen.includedPeople} ppl)`}
                        </span>
                        <span className="font-mono font-semibold text-slate-100 tabular-nums">
                          ${baseTabPrice.toFixed(2)}
                        </span>
                      </div>

                      {!chosen.perPersonService && (
                        <div className="flex items-center justify-between text-slate-400">
                          <span>
                            Extra people ({extraPeople} × $
                            {chosen.extraPersonPrice})
                          </span>
                          <span
                            className={`font-mono font-semibold tabular-nums ${
                              extraTotal > 0 ? 'text-fuchsia-300' : 'text-slate-500'
                            }`}
                          >
                            +${extraTotal.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {upgradeVipApplied && (
                        <div className="flex items-center justify-between text-amber-300">
                          <span>Upgrade to VIP</span>
                          <span className="font-mono font-semibold tabular-nums">
                            +${VIP_UPGRADE_PRICE.toFixed(2)}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-cyan-500/15">
                        <span>
                          Refill rate:{' '}
                          <strong className="text-cyan-200">
                            {upgradeVipApplied || chosen.refillPrice === 0
                              ? 'Included ($0)'
                              : `$${chosen.refillPrice}`}
                          </strong>
                        </span>
                        <span>
                          {!upgradeVipApplied && chosen.timeLimitMinutes
                            ? `${Math.round(chosen.timeLimitMinutes / 60)} hr time limit`
                            : 'No 2h cutoff'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-medium text-cyan-200/80">
                          Opening Hookah Flavors ({seatFlavors.length}/3)
                        </span>
                        <button
                          type="button"
                          onClick={onOpenFlavorManager}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-fuchsia-300 hover:text-fuchsia-200"
                        >
                          <Sparkles className="h-3 w-3" />
                          Edit Flavors
                        </button>
                      </div>
                      {renderFlavorPickerGrid(seatFlavors, setSeatFlavors)}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSeatIceHose((v) => !v)}
                      className={`flex min-h-[48px] w-full items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                        seatIceHose
                          ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200 cyber-glow-cyan'
                          : 'border-cyan-500/25 bg-[#060913] text-slate-300 hover:border-cyan-400/50'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Snowflake className="h-4 w-4 text-cyan-400" />
                        Ice Hose Add-on (+${chosen.iceHosePrice})
                      </span>
                      <span className="text-xs font-mono">
                        {seatIceHose ? 'ADDED' : 'OPTIONAL'}
                      </span>
                    </button>

                    {isOneTimeTier && (
                      <button
                        type="button"
                        onClick={() => setSeatUpgradeVip((v) => !v)}
                        className={`flex min-h-[48px] w-full items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                          seatUpgradeVip
                            ? 'border-fuchsia-400 bg-fuchsia-500/15 text-fuchsia-200 cyber-glow-magenta'
                            : 'border-cyan-500/25 bg-[#060913] text-slate-300 hover:border-fuchsia-400/50'
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Crown className="h-4 w-4 text-fuchsia-400" />
                          Upgrade to VIP (+${VIP_UPGRADE_PRICE})
                        </span>
                        <span className="text-xs font-mono">
                          {seatUpgradeVip ? 'ADDED' : 'OPTIONAL'}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        const now = Date.now();
                        const initialOrders: OrderItem[] = [
                          {
                            id: `ord-${now}-${Math.random().toString(36).slice(2, 7)}`,
                            menuItemId: chosen.menuItemId,
                            name: chosen.label,
                            category: 'hookah',
                            unitPrice:
                              chosen.basePrice +
                              (seatIceHose ? chosen.iceHosePrice : 0),
                            quantity: 1,
                            flavors:
                              seatFlavors.length > 0 ? seatFlavors : undefined,
                            iceHose: seatIceHose,
                            prepStatus: 'queued',
                            orderedAt: now,
                          },
                        ];

                        if (extraPeople > 0) {
                          const extraItemId =
                            chosen.id === 'vip_allday'
                              ? 'r-xtra-vip-allday'
                              : chosen.id === 'vip_onetime'
                              ? 'r-xtra-vip-onetime'
                              : 'r-xtra-downstairs';
                          initialOrders.push({
                            id: `ord-${now}-${Math.random().toString(36).slice(2, 7)}-xtra`,
                            menuItemId: extraItemId,
                            name: `Xtra Person · ${chosen.shortLabel}`,
                            category: 'refill',
                            unitPrice: chosen.extraPersonPrice,
                            quantity: extraPeople,
                            notes: `${computedPartySize} total (${extraPeople} extra)`,
                            prepStatus: 'served',
                            orderedAt: now,
                          });
                        }

                        if (upgradeVipApplied) {
                          initialOrders.push({
                            id: `ord-${now}-${Math.random().toString(36).slice(2, 7)}-vip`,
                            menuItemId: 'r-upgrade-vip',
                            name: 'Upgrade to VIP',
                            category: 'refill',
                            unitPrice: VIP_UPGRADE_PRICE,
                            quantity: 1,
                            notes: `Upgraded ${chosen.shortLabel} to VIP`,
                            prepStatus: 'served',
                            orderedAt: now,
                          });
                        }

                        onSeatTable(
                          table.id,
                          computedPartySize,
                          guestName.trim(),
                          initialOrders,
                          upgradeVipApplied ? 'vip_allday' : chosen.id,
                          upgradeVipApplied ? undefined : chosen.timeLimitMinutes,
                          seatTableNumber.trim() || undefined
                        );
                        setGuestName('');
                        setSeatUpgradeVip(false);
                        setSeatFlavors([]);
                      }}
                      className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-300 cyber-glow-cyan"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      Seat Party &amp; Open Tab · ${openingTotal.toFixed(2)}
                    </button>
                  </>
                );
              })()}
            </div>
          ) : editingOrderForFlavors ? (
            /* Edit Flavors on Existing Order */
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    Edit Flavors · {editingOrderForFlavors.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Select 1–3 flavors ({editingFlavorsDraft.length}/3 selected)
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={onOpenFlavorManager}
                    className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-fuchsia-500/35 bg-fuchsia-500/10 px-2.5 text-xs font-semibold text-fuchsia-200 hover:bg-fuchsia-500/20"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Catalog
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingOrderForFlavors(null)}
                    className="min-h-[40px] px-3 text-xs font-semibold text-slate-400 hover:text-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {renderFlavorPickerGrid(editingFlavorsDraft, setEditingFlavorsDraft)}

              <button
                type="button"
                onClick={() => {
                  onUpdateOrderFlavors(
                    table.id,
                    editingOrderForFlavors.id,
                    editingFlavorsDraft
                  );
                  setEditingOrderForFlavors(null);
                }}
                className="min-h-[48px] w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-300 cyber-glow-cyan"
              >
                Save Flavors to Order
              </button>
            </div>
          ) : customizingItem ? (
            /* Hookah Mix Builder */
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    {customizingItem.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Select 1–3 flavors ({selectedFlavors.length}/3 selected)
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={onOpenFlavorManager}
                    className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-fuchsia-500/35 bg-fuchsia-500/10 px-2.5 text-xs font-semibold text-fuchsia-200 hover:bg-fuchsia-500/20"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Edit Flavors
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomizingItem(null)}
                    className="min-h-[40px] px-3 text-xs font-semibold text-slate-400 hover:text-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {renderFlavorPickerGrid(selectedFlavors, setSelectedFlavors)}

              <button
                type="button"
                onClick={() => setIceHose((v) => !v)}
                className={`flex min-h-[48px] w-full items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                  iceHose
                    ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200 cyber-glow-cyan'
                    : 'border-cyan-500/25 bg-[#060913] text-slate-300'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Snowflake className="h-4 w-4 text-cyan-400" />
                  Add Ice Hose (+${activeTier.iceHosePrice})
                </span>
                <span className="text-xs font-mono">
                  {iceHose ? 'ADDED' : 'OPTIONAL'}
                </span>
              </button>

              <div>
                <label className="block text-xs font-medium text-cyan-200/80 mb-1.5">
                  Prep Notes
                </label>
                <input
                  type="text"
                  value={hookahNotes}
                  onChange={(e) => setHookahNotes(e.target.value)}
                  placeholder="e.g. Heavy mint, 2 hoses, foil pack"
                  className="w-full min-h-[44px] rounded-xl border border-cyan-500/25 bg-[#060913] px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={confirmHookahOrder}
                className="min-h-[48px] w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-300 cyber-glow-cyan"
              >
                Send to Hookah Station · $
                {(
                  customizingItem.price +
                  (iceHose ? activeTier.iceHosePrice : 0)
                ).toFixed(2)}
              </button>
            </div>
          ) : (
            /* Active Order & Ticket View */
            <div className="space-y-5">
              {/* Party Info, Table Number & Quick Actions */}
              <div className="space-y-2.5 rounded-xl border border-cyan-500/20 bg-[#060913] px-3.5 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-slate-200">
                      Party of {table.partySize}
                      {table.guestName ? ` · ${table.guestName}` : ''}
                    </span>
                    <p className="text-[11px] text-cyan-300">
                      {activeTier.label} · Refill{' '}
                      {activeTier.refillPrice === 0
                        ? 'Incl.'
                        : `$${activeTier.refillPrice}`}{' '}
                      · Ice ${activeTier.iceHosePrice}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onPrintKitchenTicket(table)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25 whitespace-nowrap"
                    >
                      <Printer className="h-3.5 w-3.5 text-cyan-300" />
                      Print Kitchen
                    </button>
                    <button
                      type="button"
                      onClick={() => onRefreshCoals(table.id)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-amber-400/35 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 whitespace-nowrap"
                    >
                      <Flame className="h-3.5 w-3.5 text-amber-400" />
                      Coals
                    </button>
                  </div>
                </div>

                {/* Inline Table # Input / Editor */}
                <div className="flex items-center justify-between gap-2 border-t border-cyan-500/15 pt-2">
                  {isEditingTableNum ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        type="text"
                        value={tableNumDraft}
                        onChange={(e) => setTableNumDraft(e.target.value)}
                        placeholder="Enter Table # (e.g. 12)"
                        aria-label="Edit table number"
                        className="flex-1 min-h-[38px] rounded-lg border border-cyan-400/50 bg-[#0B101D] px-2.5 py-1 font-mono text-xs font-bold text-cyan-200 placeholder-slate-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateTableNumber(table.id, tableNumDraft.trim());
                          setIsEditingTableNum(false);
                        }}
                        className="min-h-[38px] rounded-lg bg-cyan-400 px-3 text-xs font-bold text-slate-950 hover:bg-cyan-300"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTableNumDraft(table.tableNumber || '');
                          setIsEditingTableNum(false);
                        }}
                        className="min-h-[38px] px-2 text-xs text-slate-400 hover:text-slate-200"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs text-slate-300">
                        Kitchen Table #:{' '}
                        <strong className="font-mono text-cyan-300">
                          {table.tableNumber ? `#${table.tableNumber}` : 'Not set'}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setTableNumDraft(table.tableNumber || '');
                          setIsEditingTableNum(true);
                        }}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-cyan-500/25 bg-[#0B101D] px-2.5 text-[11px] font-semibold text-cyan-200 hover:border-cyan-400"
                      >
                        <Pencil className="h-3 w-3" />
                        {table.tableNumber ? 'Edit #' : 'Set Table #'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Upgrade One Time to VIP (+$200) */}
              {(activeTier.id === 'vip_onetime' ||
                activeTier.id === 'bar_onetime') && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 px-3.5 py-3 cyber-glow-magenta">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-fuchsia-200">
                      <Crown className="h-4 w-4 shrink-0 text-fuchsia-400" />
                      <span>Upgrade to VIP</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-300">
                      Lift time limit &amp; unlock VIP refills (+${VIP_UPGRADE_PRICE})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpgradeToVip(table.id)}
                    className="min-h-[44px] shrink-0 rounded-xl bg-fuchsia-500 px-4 text-xs font-bold text-white transition-colors hover:bg-fuchsia-400 whitespace-nowrap"
                  >
                    Upgrade +${VIP_UPGRADE_PRICE}
                  </button>
                </div>
              )}

              {/* Quick Dropdown to Add Extra People to Active Tab */}
              {!activeTier.perPersonService && (
                <div className="rounded-xl border border-cyan-500/20 bg-[#060913] px-3.5 py-3">
                  <label
                    htmlFor="active-extra-people"
                    className="block text-xs font-medium text-cyan-200 mb-2"
                  >
                    Add Extra People ({activeTier.label} · $
                    {activeTier.extraPersonPrice} each)
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      id="active-extra-people"
                      value={addExtraCount}
                      onChange={(e) =>
                        setAddExtraCount(Math.max(1, Number(e.target.value) || 1))
                      }
                      className="flex-1 min-h-[44px] rounded-xl border border-cyan-500/30 bg-[#0B101D] px-3 py-2 text-sm font-semibold text-slate-100 focus:border-cyan-400 focus:outline-none"
                    >
                      {Array.from({ length: 10 }, (_, idx) => {
                        const count = idx + 1;
                        return (
                          <option key={count} value={count}>
                            +{count} extra {count === 1 ? 'person' : 'people'} (+$
                            {count * activeTier.extraPersonPrice})
                          </option>
                        );
                      })}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const extraItemId =
                          activeTier.id === 'vip_allday'
                            ? 'r-xtra-vip-allday'
                            : activeTier.id === 'vip_onetime'
                            ? 'r-xtra-vip-onetime'
                            : 'r-xtra-downstairs';
                        onAddOrder(table.id, {
                          id: `ord-${Date.now()}-${Math.random()
                            .toString(36)
                            .slice(2, 7)}`,
                          menuItemId: extraItemId,
                          name: `Xtra Person · ${activeTier.shortLabel}`,
                          category: 'refill',
                          unitPrice: activeTier.extraPersonPrice,
                          quantity: addExtraCount,
                          prepStatus: 'served',
                          orderedAt: Date.now(),
                        });
                      }}
                      className="min-h-[44px] shrink-0 rounded-xl bg-fuchsia-500 px-4 text-xs font-bold text-white hover:bg-fuchsia-400 cyber-glow-magenta whitespace-nowrap"
                    >
                      Add +${addExtraCount * activeTier.extraPersonPrice}
                    </button>
                  </div>
                </div>
              )}

              {/* Menu Category Segmented Bar */}
              <div>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#060913] p-1 border border-cyan-500/20">
                  {(
                    [
                      { id: 'hookah', label: 'Hookah' },
                      { id: 'refill', label: 'Refills & Add-ons' },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      className={`min-h-[40px] rounded-lg px-2 text-xs font-bold transition-colors whitespace-nowrap font-display tracking-wide ${
                        activeCategory === cat.id
                          ? 'bg-cyan-400 text-slate-950 cyber-glow-cyan'
                          : 'text-slate-400 hover:text-cyan-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Menu Grid */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {filteredMenu.map((item) => {
                    const effectivePrice = getEffectiveMenuPrice(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectMenuItem(item)}
                        className="flex min-h-[64px] flex-col justify-between rounded-xl border border-cyan-500/20 bg-[#0F172A] p-3 text-left transition-colors hover:border-cyan-400/70 hover:bg-[#131F38]"
                      >
                        <span className="text-xs font-semibold text-slate-100 leading-snug">
                          {item.name}
                        </span>
                        <div className="mt-1.5 flex items-center justify-between text-xs">
                          <span className="text-slate-400 truncate">
                            {item.description || 'Tap to add'}
                          </span>
                          <span className="font-mono font-semibold text-cyan-300 ml-2 shrink-0">
                            ${effectivePrice.toFixed(0)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Current Ticket */}
              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-2">
                  Current Ticket ({table.orders.reduce((s, o) => s + o.quantity, 0)} items)
                </h3>

                {table.orders.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-cyan-500/25 px-4 py-6 text-center text-xs text-slate-500">
                    No items ordered yet. Select a hookah or add-on above.
                  </p>
                ) : (
                  <div className="divide-y divide-cyan-500/10 rounded-xl border border-cyan-500/20 bg-[#060913]">
                    {table.orders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between gap-3 px-3.5 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-100 truncate">
                            {order.name}
                          </p>
                          {(order.flavors || order.iceHose) && (
                            <p className="mt-0.5 text-xs text-fuchsia-300">
                              {order.flavors ? order.flavors.join(' + ') : ''}
                              {order.iceHose
                                ? `${order.flavors ? ' · ' : ''}Ice Hose`
                                : ''}
                            </p>
                          )}
                          {(order.category === 'hookah' || order.menuItemId === 'r1') && (
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingOrderForFlavors(order);
                                  setEditingFlavorsDraft(order.flavors ?? []);
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-200 hover:bg-fuchsia-500/20"
                              >
                                <Pencil className="h-3 w-3" />
                                {order.flavors?.length ? 'Edit Flavors' : '+ Add Flavors'}
                              </button>
                              <button
                                type="button"
                                onClick={() => onPrintKitchenTicket(table, [order])}
                                className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/20"
                              >
                                <Printer className="h-3 w-3" />
                                Print
                              </button>
                            </div>
                          )}
                          {order.notes && (
                            <p className="mt-0.5 text-xs text-slate-400">
                              Note: {order.notes}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-slate-400">
                            <span
                              className={
                                order.prepStatus === 'served'
                                  ? 'text-emerald-400'
                                  : order.prepStatus === 'prepping'
                                  ? 'text-cyan-300'
                                  : 'text-amber-400'
                              }
                            >
                              {order.prepStatus === 'queued'
                                ? 'Queued'
                                : order.prepStatus === 'prepping'
                                ? 'Lighting coals'
                                : 'Served'}
                            </span>
                            {' · '}
                            <span className="font-mono text-cyan-200">
                              ${(order.unitPrice * order.quantity).toFixed(2)}
                            </span>
                            {order.addedBy ? ` · by ${order.addedBy}` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(table.id, order.id, -1)}
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/25 bg-[#0B101D] text-slate-200 hover:border-cyan-400"
                            aria-label={`Decrease quantity of ${order.name}`}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-6 text-center font-mono text-sm font-bold text-slate-100 tabular-nums">
                            {order.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(table.id, order.id, 1)}
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/25 bg-[#0B101D] text-slate-200 hover:border-cyan-400"
                            aria-label={`Increase quantity of ${order.name}`}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Checkout Footer for Occupied Table */}
        {table.status === 'occupied' && !customizingItem && (
          <div className="border-t border-cyan-500/20 bg-[#060913] px-5 py-4 pb-safe space-y-3">
            <div className="flex justify-between text-base font-bold text-slate-100">
              <span>Total Due</span>
              <span className="font-mono text-cyan-300 tabular-nums">
                ${totals.total.toFixed(2)}
              </span>
            </div>

            <div className="flex gap-2">
              {confirmCheckout && (
                <button
                  type="button"
                  onClick={() => setConfirmCheckout(false)}
                  className="min-h-[48px] rounded-xl border border-cyan-500/30 px-4 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={handleCheckout}
                className={`flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors cyber-glow-emerald ${
                  confirmCheckout
                    ? 'bg-emerald-300 text-slate-950 hover:bg-emerald-200'
                    : 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                }`}
              >
                <Receipt className="h-4 w-4" />
                {confirmCheckout
                  ? `Confirm Close ($${totals.total.toFixed(2)})`
                  : 'Close Tab & Clear Table'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
