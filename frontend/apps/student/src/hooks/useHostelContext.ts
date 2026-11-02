import { useStore } from "@poolit/domain";
import { useProfile } from "../state/ProfileContext";

/** The student's hostel, its store, and the pooling slot they'd join. */
export function useHostelContext() {
  const { hostels, vendors, slots, orders, poolCounts } = useStore();
  const { profile } = useProfile();

  const hostel = hostels.find((h) => h.id === profile.hostelId) ?? hostels[0];
  const vendor = vendors.find((v) => v.hostelId === hostel.id);
  const slot =
    slots.find((s) => s.hostelId === hostel.id && s.status === "open") ??
    slots.find((s) => s.hostelId === hostel.id && s.status !== "dispatched");
  // `orders` holds only this student's own orders; the pool size comes from
  // the server's live count so other students' orders never reach this app.
  const myOrdersInSlot = slot ? orders.filter((o) => o.slotId === slot.id) : [];
  const orderCount = slot ? (poolCounts[slot.id] ?? myOrdersInSlot.length) : 0;

  return { hostel, vendor, slot, myOrdersInSlot, orderCount };
}
