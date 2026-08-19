export const CATEGORIES = [
  "Snacks",
  "Instant Food",
  "Drinks",
  "Essentials",
  "Fresh",
  "Midnight Cravings",
] as const;

export type MenuCategory = (typeof CATEGORIES)[number];

export interface Hostel {
  id: string;
  name: string;
  /** Blocks students can pick from when setting their delivery address. */
  blocks: string[];
}

export interface MenuItem {
  id: string;
  vendorId: string;
  name: string;
  category: MenuCategory;
  /** Short descriptor shown under the name, e.g. "70 g pack". */
  unit: string;
  price: number;
  /** Struck-through original price when the item is discounted. */
  mrp?: number;
  stockQty: number;
  lowStockThreshold: number;
  rating: number;
  ratingCount: number;
  isVeg: boolean;
  /** Emoji stand-in for product photography (see README note). */
  art: string;
  /** Soft tint behind the product art. */
  tint: string;
}

export interface Vendor {
  id: string;
  name: string;
  hostelId: string;
  /** Minutes the store needs to pack a pooled run. */
  prepMinutes: number;
  menu: MenuItem[];
}

export type SlotStatus = "open" | "closed" | "dispatched";

export interface Slot {
  id: string;
  hostelId: string;
  vendorId: string;
  status: SlotStatus;
  opensAt: number;
  closesAt: number;
}

export type OrderStatus = "placed" | "pooled" | "dispatched" | "delivered";

export interface OrderLineItem {
  menuItemId: string;
  qty: number;
}

export interface Order {
  id: string;
  slotId: string;
  studentName: string;
  /** Delivery address captured at order time. */
  block?: string;
  room?: string;
  items: OrderLineItem[];
  status: OrderStatus;
  /** Locked in once the slot closes; undefined while the slot is still open. */
  deliveryFeeCharged?: number;
  tip?: number;
  paymentMethod?: string;
  note?: string;
  createdAt: number;
}

export interface RestockLogEntry {
  id: string;
  vendorId: string;
  menuItemId: string;
  amount: number;
  at: number;
}

export interface PickListLine {
  menuItemId: string;
  name: string;
  art: string;
  totalQty: number;
}

export interface Rider {
  name: string;
  phone: string;
  vehicle: string;
  rating: number;
}
