const supabase = require("../config/supabaseClient");
const { toStaffJSON } = require("../utils/serialize");

const STATUSES = ["active", "break", "inactive"];

// GET /vendors/:vendorId/staff
exports.getStaff = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("staff")
      .select("*")
      .eq("vendor_id", req.params.vendorId)
      .order("created_at");
    if (error) throw error;
    res.json(data.map(toStaffJSON));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch staff" });
  }
};

// POST /vendors/:vendorId/staff
exports.createStaff = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { name, role, email } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "name is required" });
    }
    if (!role || typeof role !== "string" || !role.trim()) {
      return res.status(400).json({ message: "role is required" });
    }
    if (email !== undefined && email !== null && typeof email !== "string") {
      return res.status(400).json({ message: "email must be a string" });
    }

    const { data, error } = await supabase
      .from("staff")
      .insert({
        vendor_id: vendorId,
        name: name.trim(),
        role: role.trim(),
        email: typeof email === "string" && email.trim() ? email.trim() : null,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23503") {
        return res.status(404).json({ message: "Vendor not found" });
      }
      throw error;
    }

    res.status(201).json(toStaffJSON(data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add staff member" });
  }
};

// PATCH /staff/:staffId
exports.updateStaff = async (req, res) => {
  try {
    const { name, role, status } = req.body;
    const update = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "name must be a non-empty string" });
      }
      update.name = name.trim();
    }
    if (role !== undefined) {
      if (typeof role !== "string" || !role.trim()) {
        return res.status(400).json({ message: "role must be a non-empty string" });
      }
      update.role = role.trim();
    }
    if (status !== undefined) {
      if (!STATUSES.includes(status)) {
        return res.status(400).json({ message: `status must be one of: ${STATUSES.join(", ")}` });
      }
      update.status = status;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }
    update.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("staff")
      .update(update)
      .eq("id", req.params.staffId)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "Staff member not found" });
    }

    res.json(toStaffJSON(data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update staff member" });
  }
};

// DELETE /staff/:staffId
exports.deleteStaff = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("staff")
      .delete()
      .eq("id", req.params.staffId)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "Staff member not found" });
    }
    res.json({ message: "Staff member removed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to remove staff member" });
  }
};
