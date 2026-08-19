import { useStore } from "@poolit/domain";
import { useProfile } from "../state/ProfileContext";

/** The student's hostel, its store, and the pooling slot they'd join. */
export function useHostelContext() {
  const { hostels, vendors, slots, orders } = useStore();
  const { profile } = useProfile();

  const hostel = hostels.find((h) => h.id === profile.hostelId) ?? hostels[0];
  const vendor = vendors.find((v) => v.hostelId === hostel.id);
  const slot =
    slots.find((s) => s.hostelId === hostel.id && s.status === "open") ??
    slots.find((s) => s.hostelId === hostel.id && s.status !== "dispatched");
  const slotOrders = slot ? orders.filter((o) => o.slotId === slot.id) : [];

  return { hostel, vendor, slot, slotOrders, orderCount: slotOrders.length };
}
