import type {
  FlavorOption,
  LoungeSettings,
  LoungeTable,
  MenuItem,
  SeatingTierId,
  TableFloor,
} from '../types.ts';

export const VIP_UPGRADE_PRICE = 200;
export const DEFAULT_SETTINGS: LoungeSettings = {
  coalAlertMinutes: 25,
  longStayAlertMinutes: 120,
  kitchenPrinterMode: 'system',
  kitchenPrinterIp: '',
  kitchenPrinterPort: 9100,
  kitchenPrinterWidth: '80mm',
  autoPrintKitchenTicket: false,
};
export const COAL_REPEAT_MINUTES = 10;

export const FLOORS: TableFloor[] = ['Floor 1', 'Floor 2', 'Outside'];

export const SHISHA_FLAVORS: string[] = [
  'Double Apple',
  'Mint',
  'Blue Mist',
  'Love 66',
  'Lady Killer',
  'Grape Mint',
  'Watermelon',
  'Peach',
  'Pan Raas',
  'Lemon Mint',
  'Mango',
  'Gummy Bear',
];

export function createInitialFlavors(): FlavorOption[] {
  return SHISHA_FLAVORS.map((name, idx) => ({
    id: `flv-${idx + 1}`,
    name,
    available: true,
  }));
}

export const BOWL_UPGRADES = [
  { label: 'Classic Clay', extraPrice: 0 },
  { label: 'Phunnel Bowl', extraPrice: 4 },
  { label: 'Pineapple Head', extraPrice: 12 },
  { label: 'Orange Head', extraPrice: 10 },
];

export interface SeatingTierConfig {
  id: SeatingTierId;
  menuItemId: string;
  label: string;
  shortLabel: string;
  basePrice: number;
  includedPeople: number;
  extraPersonPrice: number;
  perPersonService: boolean;
  iceHosePrice: number;
  refillPrice: number;
  timeLimitMinutes?: number;
  summary: string;
}

export const SEATING_TIERS: Record<SeatingTierId, SeatingTierConfig> = {
  vip_allday: {
    id: 'vip_allday',
    menuItemId: 'h-vip-allday',
    label: 'All Day VIP',
    shortLabel: 'All Day VIP',
    basePrice: 250,
    includedPeople: 4,
    extraPersonPrice: 65,
    perPersonService: false,
    iceHosePrice: 15,
    refillPrice: 0,
    summary: 'Up to 4 ppl · +$65/extra · Refills incl.',
  },
  vip_onetime: {
    id: 'vip_onetime',
    menuItemId: 'h-vip-onetime',
    label: 'One Time VIP',
    shortLabel: 'One Time VIP (2h)',
    basePrice: 100,
    includedPeople: 4,
    extraPersonPrice: 20,
    perPersonService: false,
    iceHosePrice: 15,
    refillPrice: 20,
    timeLimitMinutes: 120,
    summary: 'Up to 4 ppl · +$20/extra · 2h limit',
  },
  bar_allday: {
    id: 'bar_allday',
    menuItemId: 'h-bar-allday',
    label: 'Bar Top · All Day',
    shortLabel: 'Bar All Day',
    basePrice: 100,
    includedPeople: 1,
    extraPersonPrice: 100,
    perPersonService: true,
    iceHosePrice: 15,
    refillPrice: 20,
    summary: 'Single person service · $100/person',
  },
  bar_onetime: {
    id: 'bar_onetime',
    menuItemId: 'h-bar-onetime',
    label: 'Bar Top · One Time',
    shortLabel: 'Bar One Time',
    basePrice: 60,
    includedPeople: 1,
    extraPersonPrice: 60,
    perPersonService: true,
    iceHosePrice: 15,
    refillPrice: 20,
    summary: 'Single person service · $60/person',
  },
  downstairs: {
    id: 'downstairs',
    menuItemId: 'h-downstairs',
    label: 'Downstairs Hookah',
    shortLabel: 'Downstairs',
    basePrice: 50,
    includedPeople: 4,
    extraPersonPrice: 10,
    perPersonService: false,
    iceHosePrice: 10,
    refillPrice: 15,
    summary: 'Up to 4 ppl · +$10/extra · Ice $10',
  },
};

export const SEATING_TIER_LIST: SeatingTierConfig[] = [
  SEATING_TIERS.vip_allday,
  SEATING_TIERS.vip_onetime,
  SEATING_TIERS.bar_allday,
  SEATING_TIERS.bar_onetime,
  SEATING_TIERS.downstairs,
];

export function getTableSeatingTier(table: LoungeTable): SeatingTierConfig {
  if (table.seatingTier && SEATING_TIERS[table.seatingTier]) {
    return SEATING_TIERS[table.seatingTier];
  }
  const orderIds = new Set(table.orders.map((o) => o.menuItemId));
  if (orderIds.has('r-upgrade-vip')) {
    return SEATING_TIERS.vip_allday;
  }
  if (orderIds.has('h-vip-allday') || orderIds.has('h-allday')) {
    return SEATING_TIERS.vip_allday;
  }
  if (orderIds.has('h-vip-onetime')) {
    return SEATING_TIERS.vip_onetime;
  }
  if (orderIds.has('h-bar-allday')) {
    return SEATING_TIERS.bar_allday;
  }
  if (orderIds.has('h-bar-onetime')) {
    return SEATING_TIERS.bar_onetime;
  }
  if (orderIds.has('h-downstairs') || orderIds.has('h-onetime')) {
    return SEATING_TIERS.downstairs;
  }
  if (table.zone === 'Bar') return SEATING_TIERS.bar_onetime;
  if (table.zone === 'VIP') return SEATING_TIERS.vip_onetime;
  return SEATING_TIERS.downstairs;
}

export const ICE_HOSE_PRICE = 15;

export const MENU_ITEMS: MenuItem[] = [
  { id: 'h-vip-allday', name: 'All Day VIP', category: 'hookah', price: 250, description: 'Up to 4 ppl · unlimited refills' },
  { id: 'h-vip-onetime', name: 'One Time VIP (2h)', category: 'hookah', price: 100, description: 'Up to 4 ppl · 2 hr time limit' },
  { id: 'h-bar-allday', name: 'Bar Top · All Day', category: 'hookah', price: 100, description: 'Single person bar service' },
  { id: 'h-bar-onetime', name: 'Bar Top · One Time', category: 'hookah', price: 60, description: 'Single person bar service' },
  { id: 'h-downstairs', name: 'Downstairs Hookah', category: 'hookah', price: 50, description: 'Up to 4 ppl · standard seating' },
  { id: 'r1', name: 'Hookah Refill', category: 'refill', price: 15, description: 'Tier-priced fresh bowl' },
  { id: 'r-ice', name: 'Ice Hose Add-on', category: 'refill', price: 15, description: 'Tier-priced chilled hose' },
  { id: 'r-xtra-vip-allday', name: 'Xtra Person · All Day VIP', category: 'refill', price: 65, description: 'Over 4 ppl · All Day VIP' },
  { id: 'r-xtra-vip-onetime', name: 'Xtra Person · One Time VIP', category: 'refill', price: 20, description: 'Over 4 ppl · One Time VIP' },
  { id: 'r-xtra-downstairs', name: 'Xtra Person · Downstairs', category: 'refill', price: 10, description: 'Over 4 ppl · Downstairs' },
  { id: 'r-upgrade-vip', name: 'Upgrade to VIP', category: 'refill', price: 200, description: 'Upgrade One Time to VIP' },
  { id: 'r2', name: 'Extra Coconut Coals (3pc)', category: 'refill', price: 0, description: 'Complimentary rotation' },
];

export function createInitialTables(now = Date.now()): LoungeTable[] {
  const min = 60_000;
  return [
    // Floor 1 (Main Lounge & Bar)
    {
      id: 'f1-1',
      name: 'L1',
      floor: 'Floor 1',
      zone: 'Lounge',
      seats: 4,
      shape: 'square',
      x: 6,
      y: 10,
      status: 'occupied',
      seatingTier: 'downstairs',
      partySize: 3,
      guestName: 'Karim',
      serverName: 'Nadia',
      seatedAt: now - 19 * min,
      lastCoalCheckAt: now - 19 * min,
      orders: [
        {
          id: 'ord-seed-1',
          menuItemId: 'h-downstairs',
          name: 'Downstairs Hookah',
          category: 'hookah',
          unitPrice: 54,
          quantity: 1,
          flavors: ['Love 66', 'Mint'],
          bowlUpgrade: 'Phunnel Bowl',
          iceHose: false,
          addedBy: 'Nadia',
          prepStatus: 'served',
          orderedAt: now - 18 * min,
        },
      ],
      updatedAt: now,
    },
    { id: 'f1-2', name: 'L2', floor: 'Floor 1', zone: 'Lounge', seats: 4, shape: 'square', x: 38, y: 10, status: 'available', orders: [], updatedAt: now },
    { id: 'f1-3', name: 'Bar 1', floor: 'Floor 1', zone: 'Bar', seats: 2, shape: 'round', x: 70, y: 10, status: 'available', orders: [], updatedAt: now },
    { id: 'f1-4', name: 'L3', floor: 'Floor 1', zone: 'Lounge', seats: 6, shape: 'round', x: 6, y: 46, status: 'available', orders: [], updatedAt: now },
    {
      id: 'f1-5',
      name: 'VIP 1',
      floor: 'Floor 1',
      zone: 'VIP',
      seats: 8,
      shape: 'booth',
      x: 38,
      y: 46,
      status: 'occupied',
      seatingTier: 'vip_allday',
      partySize: 6,
      guestName: 'Maya Birthday',
      serverName: 'Nadia',
      seatedAt: now - 34 * min,
      lastCoalCheckAt: now - 26 * min,
      orders: [
        {
          id: 'ord-seed-3',
          menuItemId: 'h-vip-allday',
          name: 'All Day VIP',
          category: 'hookah',
          unitPrice: 277,
          quantity: 1,
          flavors: ['Blue Mist', 'Lady Killer', 'Mint'],
          bowlUpgrade: 'Pineapple Head',
          iceHose: true,
          notes: 'Extra ice cubes',
          addedBy: 'Nadia',
          prepStatus: 'served',
          orderedAt: now - 33 * min,
        },
        {
          id: 'ord-seed-3-xtra',
          menuItemId: 'r-xtra-vip-allday',
          name: 'Xtra Person · All Day VIP',
          category: 'refill',
          unitPrice: 65,
          quantity: 2,
          notes: 'Party of 6 (2 over 4)',
          addedBy: 'Nadia',
          prepStatus: 'served',
          orderedAt: now - 33 * min,
        },
      ],
      updatedAt: now,
    },

    // Floor 2 (Upstairs / Mezzanine VIP)
    { id: 'f2-1', name: '2F-1', floor: 'Floor 2', zone: 'Lounge', seats: 4, shape: 'square', x: 8, y: 12, status: 'available', orders: [], updatedAt: now },
    { id: 'f2-2', name: '2F-2', floor: 'Floor 2', zone: 'Lounge', seats: 4, shape: 'square', x: 54, y: 12, status: 'available', orders: [], updatedAt: now },
    {
      id: 'f2-3',
      name: '2F-VIP 1',
      floor: 'Floor 2',
      zone: 'VIP',
      seats: 8,
      shape: 'booth',
      x: 8,
      y: 48,
      status: 'occupied',
      seatingTier: 'vip_onetime',
      timeLimitMinutes: 120,
      partySize: 5,
      guestName: 'Tariq',
      serverName: 'Sam',
      seatedAt: now - 11 * min,
      lastCoalCheckAt: now - 11 * min,
      orders: [
        {
          id: 'ord-seed-5',
          menuItemId: 'h-vip-onetime',
          name: 'One Time VIP (2h)',
          category: 'hookah',
          unitPrice: 100,
          quantity: 1,
          flavors: ['Double Apple', 'Mint'],
          bowlUpgrade: 'Classic Clay',
          iceHose: false,
          addedBy: 'Sam',
          prepStatus: 'prepping',
          orderedAt: now - 4 * min,
        },
        {
          id: 'ord-seed-5-xtra',
          menuItemId: 'r-xtra-vip-onetime',
          name: 'Xtra Person · One Time VIP',
          category: 'refill',
          unitPrice: 20,
          quantity: 1,
          notes: 'Party of 5 (1 over 4)',
          addedBy: 'Sam',
          prepStatus: 'served',
          orderedAt: now - 11 * min,
        },
      ],
      updatedAt: now,
    },
    { id: 'f2-4', name: '2F-VIP 2', floor: 'Floor 2', zone: 'VIP', seats: 10, shape: 'booth', x: 54, y: 48, status: 'available', orders: [], updatedAt: now },

    // Outside Seating (Patio & Cabanas)
    {
      id: 'out-1',
      name: 'Patio 1',
      floor: 'Outside',
      zone: 'Patio',
      seats: 4,
      shape: 'round',
      x: 8,
      y: 12,
      status: 'occupied',
      seatingTier: 'downstairs',
      partySize: 2,
      guestName: 'Elena',
      serverName: 'Sam',
      seatedAt: now - 46 * min,
      lastCoalCheckAt: now - 12 * min,
      orders: [
        {
          id: 'ord-seed-6',
          menuItemId: 'h-downstairs',
          name: 'Downstairs Hookah',
          category: 'hookah',
          unitPrice: 50,
          quantity: 1,
          flavors: ['Watermelon', 'Mint'],
          bowlUpgrade: 'Classic Clay',
          iceHose: false,
          addedBy: 'Sam',
          prepStatus: 'served',
          orderedAt: now - 45 * min,
        },
      ],
      updatedAt: now,
    },
    { id: 'out-2', name: 'Patio 2', floor: 'Outside', zone: 'Patio', seats: 4, shape: 'round', x: 54, y: 12, status: 'available', orders: [], updatedAt: now },
    { id: 'out-3', name: 'Patio 3', floor: 'Outside', zone: 'Patio', seats: 6, shape: 'square', x: 8, y: 48, status: 'available', orders: [], updatedAt: now },
    { id: 'out-4', name: 'Cabana 1', floor: 'Outside', zone: 'VIP', seats: 8, shape: 'booth', x: 54, y: 48, status: 'available', orders: [], updatedAt: now },
  ];
}
