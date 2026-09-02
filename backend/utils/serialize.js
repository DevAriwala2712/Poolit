// Maps snake_case Postgres rows to the same camelCase JSON shapes the old
// Mongoose toJSON() transforms produced, so the frontend needs no changes.

function toHostelJSON(row) {
  return {
    id: row.id,
    name: row.name,
    blocks: row.blocks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toVendorJSON(row) {
  return {
    id: row.id,
    name: row.name,
    hostelId: row.hostel_id,
    prepMinutes: row.prep_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMenuItemJSON(row) {
  const json = {
    id: row.id,
    vendorId: row.vendor_id,
    name: row.name,
    category: row.category,
    price: row.price,
    unit: row.unit,
    rating: row.rating,
    ratingCount: row.rating_count,
    isVeg: row.is_veg,
    art: row.art,
    tint: row.tint,
    stockQty: row.stock_qty,
    lowStockThreshold: row.low_stock_threshold,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.mrp !== null && row.mrp !== undefined) {
    json.mrp = row.mrp;
  }
  return json;
}

function toSlotJSON(row) {
  return {
    id: row.id,
    hostelId: row.hostel_id,
    vendorId: row.vendor_id,
    status: row.status,
    opensAt: new Date(row.opens_at).getTime(),
    closesAt: new Date(row.closes_at).getTime(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toOrderJSON(row) {
  const json = {
    id: row.id,
    slotId: row.slot_id,
    studentName: row.student_name,
    block: row.block ?? undefined,
    room: row.room ?? undefined,
    tip: row.tip,
    paymentMethod: row.payment_method ?? undefined,
    note: row.note ?? undefined,
    items: (row.items || []).map((item) => ({
      menuItemId: item.menuItemId,
      qty: item.qty,
    })),
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
  };
  if (row.delivery_fee_charged !== null && row.delivery_fee_charged !== undefined) {
    json.deliveryFeeCharged = row.delivery_fee_charged;
  }
  return json;
}

function toRestockLogJSON(row) {
  return {
    id: row.id,
    vendorId: row.vendor_id,
    menuItemId: row.menu_item_id,
    amount: row.amount,
    at: new Date(row.at).getTime(),
  };
}

module.exports = {
  toHostelJSON,
  toVendorJSON,
  toMenuItemJSON,
  toSlotJSON,
  toOrderJSON,
  toRestockLogJSON,
};
