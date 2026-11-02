const { reportError } = require("../utils/reportError");
const supabase = require("../config/supabaseClient");

/**
 * Store logins (vendor_users): who can sign in to a store's console and with
 * what role. Owners manage them; staff can use the console but not manage
 * people, settings or prices. Distinct from the `staff` table, which is the
 * store's roster of people (names/shifts), not accounts.
 */

async function ownerCount(vendorId) {
  const { count, error } = await supabase
    .from("vendor_users")
    .select("user_id", { count: "exact", head: true })
    .eq("vendor_id", vendorId)
    .eq("role", "owner");
  if (error) throw error;
  return count;
}

async function emailFor(userId) {
  const { data } = await supabase.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

// GET /vendors/:vendorId/members
exports.listMembers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("vendor_users")
      .select("user_id, role, created_at")
      .eq("vendor_id", req.params.vendorId)
      .order("created_at");
    if (error) throw error;
    const members = await Promise.all(
      data.map(async (m) => ({
        userId: m.user_id,
        role: m.role,
        email: await emailFor(m.user_id),
        you: m.user_id === req.user.id,
        createdAt: m.created_at,
      })),
    );
    res.json(members);
  } catch (err) {
    reportError(err, req);
    res.status(500).json({ message: "Failed to load team" });
  }
};

// POST /vendors/:vendorId/members { email, role } — invite by email
exports.inviteMember = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { email, role } = req.body;

    // Reuse the account if the email already has one, otherwise send an invite.
    let userId;
    const { data: invited, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email);
    if (inviteErr) {
      if (!/already.*(registered|exists)/i.test(inviteErr.message)) throw inviteErr;
      const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      if (listErr) throw listErr;
      userId = list.users.find((u) => u.email?.toLowerCase() === email)?.id;
      if (!userId) return res.status(404).json({ code: "user_not_found", message: "Couldn't find that account" });
    } else {
      userId = invited.user.id;
    }

    const { error } = await supabase
      .from("vendor_users")
      .upsert({ user_id: userId, vendor_id: vendorId, role }, { onConflict: "user_id,vendor_id", ignoreDuplicates: true });
    if (error) throw error;

    res.status(201).json({ userId, email, role, invited: !inviteErr });
  } catch (err) {
    reportError(err, req);
    res.status(500).json({ message: "Failed to invite team member" });
  }
};

// PATCH /vendors/:vendorId/members/:userId { role }
exports.updateMember = async (req, res) => {
  try {
    const { vendorId, userId } = req.params;
    const { role } = req.body;

    const { data: current, error: curErr } = await supabase
      .from("vendor_users").select("role").eq("vendor_id", vendorId).eq("user_id", userId).maybeSingle();
    if (curErr) throw curErr;
    if (!current) return res.status(404).json({ message: "Team member not found" });

    if (current.role === "owner" && role !== "owner" && (await ownerCount(vendorId)) <= 1) {
      return res.status(409).json({ code: "last_owner", message: "A store needs at least one owner" });
    }
    const { error } = await supabase
      .from("vendor_users").update({ role }).eq("vendor_id", vendorId).eq("user_id", userId);
    if (error) throw error;
    res.json({ userId, role });
  } catch (err) {
    reportError(err, req);
    res.status(500).json({ message: "Failed to update team member" });
  }
};

// DELETE /vendors/:vendorId/members/:userId
exports.removeMember = async (req, res) => {
  try {
    const { vendorId, userId } = req.params;
    const { data: current, error: curErr } = await supabase
      .from("vendor_users").select("role").eq("vendor_id", vendorId).eq("user_id", userId).maybeSingle();
    if (curErr) throw curErr;
    if (!current) return res.status(404).json({ message: "Team member not found" });

    if (current.role === "owner" && (await ownerCount(vendorId)) <= 1) {
      return res.status(409).json({ code: "last_owner", message: "A store needs at least one owner" });
    }
    const { error } = await supabase
      .from("vendor_users").delete().eq("vendor_id", vendorId).eq("user_id", userId);
    if (error) throw error;
    res.json({ message: "Removed from the store" });
  } catch (err) {
    reportError(err, req);
    res.status(500).json({ message: "Failed to remove team member" });
  }
};
