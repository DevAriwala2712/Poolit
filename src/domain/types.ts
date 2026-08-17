export type MenuCategory = "Mains" | "Snacks" | "Beverages" | "Desserts";

export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  price: number;
  unit: string;
  stockQty: number;
  lowStockThreshold: number;
}

export interface Vendor {
  id: string;
  name: string;
  hostelId: string;
  menu: MenuItem[];
}

export interface RestockLogEntry {
  id: string;
  vendorId: string;
  menuItemId: string;
  amount: number;
  at: number;
}

export interface Hostel {
  id: string;
  name: string;
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
  items: OrderLineItem[];
  status: OrderStatus;
  /** Locked in once the slot closes; undefined while the slot is still open */
  deliveryFeeCharged?: number;
  createdAt: number;
}

export interface PickListLine {
  menuItemId: string;
  name: string;
  totalQty: number;
}
