const supabase = require("../config/supabaseClient");
const { toOrderJSON, toSlotJSON } = require("../utils/serialize");

function toStudentJSON(row) {
  if (!row) return null;
  return {
    name: row.name,
    hostelId: row.hostel_id ?? undefined,
    block: row.block ?? undefined,
    room: row.room ?? undefined,
  };
}

// GET /me — the signed-in student's account + saved profile (null until set)
exports.getMe = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (error) throw error;
    res.json({ userId: req.user.id, phone: req.user.phone || null, profile: toStudentJSON(data) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load your profile" });
  }
};

// PUT /me — create or update the student's profile
exports.updateMe = async (req, res) => {
  try {
    const { name, hostelId, block, room } = req.body || {};
    if (typeof name !== "string" || !name.trim() || name.trim().length > 60) {
      return res.status(400).json({ message: "name is required (max 60 characters)" });
    }
    if (hostelId !== undefined && hostelId !== null && typeof hostelId !== "string") {
      return res.status(400).json({ message: "hostelId must be a string" });
    }
    if (block !== undefined && block !== null && (typeof block !== "string" || block.length > 40)) {
      return res.status(400).json({ message: "block must be text (max 40 characters)" });
    }
    if (room !== undefined && room !== null && (typeof room !== "string" || room.length > 20)) {
      return res.status(400).json({ message: "room must be text (max 20 characters)" });
    }

    const { data, error } = await supabase
      .from("students")
      .upsert(
        {
          user_id: req.user.id,
          name: name.trim(),
          phone: req.user.phone || null,
          hostel_id: hostelId || null,
          block: block?.trim() || null,
          room: room?.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select()
      .single();
    if (error) {
      if (error.code === "23503") return res.status(400).json({ message: "Unknown hostel" });
      throw error;
    }
    res.json({ userId: req.user.id, phone: req.user.phone || null, profile: toStudentJSON(data) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to save your profile" });
  }
};

// GET /me/orders — only the caller's own orders, newest first, with their slots
exports.getMyOrders = async (req, res) => {
  try {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("student_id", req.user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;

    const slotIds = [...new Set(orders.map((o) => o.slot_id))];
    let slots = [];
    if (slotIds.length > 0) {
      const { data, error: slotErr } = await supabase.from("slots").select("*").in("id", slotIds);
      if (slotErr) throw slotErr;
      slots = data;
    }
    res.json({ orders: orders.map(toOrderJSON), slots: slots.map(toSlotJSON) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load your orders" });
  }
};
