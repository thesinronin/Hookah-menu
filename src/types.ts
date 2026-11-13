export type TableFloor = 'Floor 1' | 'Floor 2' | 'Outside';
export type TableZone = 'Lounge' | 'VIP' | 'Bar' | 'Patio';
export type TableStatus = 'available' | 'occupied';
export type TableShape = 'square' | 'round' | 'booth';
export type PrepStatus = 'queued' | 'prepping' | 'served';
export type MenuCategory = 'hookah' | 'refill' | 'drinks' | 'food';
export type AlertMode = 'chime_voice' | 'chime_only' | 'silent';
export type StaffRole = 'Server' | 'Hookah Master' | 'Manager';
export type SeatingTierId =
  | 'vip_allday'
  | 'vip_onetime'
  | 'bar_allday'
  | 'bar_onetime'
  | 'downstairs';

export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  price: number;
  description?: string;
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
}

export interface LoungeTable {
  id: string;
  name: string;
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
  sessions: CompletedSession[];
}

export interface LoungeStateSnapshot {
  tables: LoungeTable[];
  history: CompletedSession[];
  settings: LoungeSettings;
  activeStaff: ActiveStaffMember[];
  lastBatchReport?: BatchReport | null;
}
