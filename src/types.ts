export type TableFloor = 'Floor 1' | 'Floor 2' | 'Outside';
export type TableZone = 'Lounge' | 'VIP' | 'Bar' | 'Patio';
export type TableStatus = 'available' | 'occupied';
export type TableShape = 'square' | 'round' | 'booth';
export type PrepStatus = 'queued' | 'prepping' | 'served';
export type MenuCategory = 'hookah' | 'refill';
export type AlertMode = 'chime_voice' | 'chime_only' | 'silent';
export type StaffRole = 'Server' | 'Hookah Master' | 'Manager';
export type SeatingTierId =
  | 'vip_allday'
  | 'vip_onetime'
  | 'bar_allday'
  | 'bar_onetime'
  | 'downstairs';
export type PrinterMode = 'system' | 'network' | 'bluetooth';
export type PrinterPaperWidth = '80mm' | '58mm';
export type PaymentMethod = 'card' | 'cash' | 'split';

export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  price: number;
  description?: string;
}

export type FlavorCategory = 'flavor' | 'blend';

export interface FlavorOption {
  id: string;
  name: string;
  available: boolean;
  category?: FlavorCategory;
  recipe?: string;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  category: MenuCategory;
  unitPrice: number;
  quantity: number;
  flavors?: string[];
  bowlUpgrade?: string;
  iceHose?: boolean;
  notes?: string;
  addedBy?: string;
  prepStatus: PrepStatus;
  orderedAt: number;
  kitchenPrintedAt?: number;
}

export interface LoungeTable {
  id: string;
  name: string;
  tableNumber?: string;
  floor: TableFloor;
  zone: TableZone;
  seats: number;
  shape: TableShape;
  /** Position on 2D floor canvas as percentage (2 - 84) */
  x: number;
  y: number;
  status: TableStatus;
  seatingTier?: SeatingTierId;
  timeLimitMinutes?: number;
  partySize?: number;
  guestName?: string;
  serverName?: string;
  seatedAt?: number;
  lastCoalCheckAt?: number;
  orders: OrderItem[];
  updatedAt: number;
}

export interface CompletedSession {
  id: string;
  tableName: string;
  floor: TableFloor;
  zone: TableZone;
  partySize: number;
  guestName?: string;
  serverName?: string;
  seatedAt: number;
  closedAt: number;
  durationMinutes: number;
  orders: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod?: PaymentMethod;
  cashPaid?: number;
  cardPaid?: number;
  splitWays?: number;
}

export interface StaffProfile {
  clientId: string;
  name: string;
  role: StaffRole;
  alertMode: AlertMode;
}

export interface ActiveStaffMember {
  clientId: string;
  name: string;
  role: StaffRole;
  connectedAt: number;
}

export interface LoungeSettings {
  coalAlertMinutes: number;
  longStayAlertMinutes: number;
  kitchenPrinterMode?: PrinterMode;
  kitchenPrinterIp?: string;
  kitchenPrinterPort?: number;
  kitchenPrinterWidth?: PrinterPaperWidth;
  autoPrintKitchenTicket?: boolean;
}

export interface KitchenTicketItem {
  name: string;
  quantity: number;
  bowlSelection?: string;
  flavors?: string[];
  iceHose?: boolean;
  notes?: string;
}

export interface KitchenTicketPayload {
  tableId?: string;
  tableNumber: string;
  tableName: string;
  floor: TableFloor;
  zone: TableZone;
  serverName?: string;
  guestName?: string;
  printedAt: number;
  items: KitchenTicketItem[];
}

export interface BatchReport {
  id: string;
  closedAt: number;
  closedBy: string;
  totalTabs: number;
  autoClosedOpenTables: number;
  subtotal: number;
  tax: number;
  total: number;
  cashTotal?: number;
  cardTotal?: number;
  sessions: CompletedSession[];
}

export interface LoungeStateSnapshot {
  tables: LoungeTable[];
  history: CompletedSession[];
  settings: LoungeSettings;
  activeStaff: ActiveStaffMember[];
  lastBatchReport?: BatchReport | null;
  flavors?: FlavorOption[];
}
