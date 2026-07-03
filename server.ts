import express from "express";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Log incoming requests for Vercel debugging
app.use((req, res, next) => {
  console.log(`[Vercel Serverless] ${req.method} ${req.url}`);
  console.log(`[Vercel Serverless] Headers - Auth: ${req.headers.authorization ? "Present" : "Missing"}`);
  next();
});

// Initialize Supabase admin client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin: ReturnType<typeof createClient<any, any, any>> | null = null;
if (supabaseUrl && supabaseServiceKey) {
  supabaseAdmin = createClient<any, any, any>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  console.log("[Supabase Admin] Successfully initialized client");
} else {
  console.log(`[Supabase Admin] Failed to initialize: URL is ${supabaseUrl ? "Present" : "Missing"}, Service Key is ${supabaseServiceKey ? "Present" : "Missing"}`);
}

// Middleware to verify admin status
const requireAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Supabase Admin client not initialized" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "No authorization header" });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Check role in profiles
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    return res.status(403).json({ error: "Forbidden: Admins only" });
  }

  (req as any).user = user;
  next();
};

// --- API Routes ---

// Get all users (Admin only)
app.get("/api/users", requireAdmin, async (req, res) => {
  const { data: profiles, error } = await supabaseAdmin!.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(profiles);
});

// Create user (Admin only)
app.post("/api/users", requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  const operatorId = (req as any).user.id;

  try {
    const dummyEmail = `${username}@system.local`;
    
    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin!.auth.admin.createUser({
      email: dummyEmail,
      password: password,
      email_confirm: true,
      user_metadata: { username }
    });

    if (authError) throw authError;

    // Update profile role
    if (role === 'admin') {
      const { error: updateError } = await supabaseAdmin!
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', authData.user.id);
      
      if (updateError) throw updateError;
    }

    // Log operation
    await supabaseAdmin!.from("audit_logs").insert({
      operator_id: operatorId,
      operation_type: "CREATE_USER",
      target_type: "profiles",
      target_id: authData.user.id,
      detail: `Created user ${username} with role ${role || 'user'}`
    });

    res.json({ message: "User created successfully", user: authData.user });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update user (Admin only) - disable/enable
app.put("/api/users/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  const operatorId = (req as any).user.id;

  try {
    // Cannot disable yourself
    if (id === operatorId && !is_active) {
      return res.status(400).json({ error: "You cannot disable your own account." });
    }

    const { error } = await supabaseAdmin!.from("profiles").update({ is_active, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;

    await supabaseAdmin!.from("audit_logs").insert({
      operator_id: operatorId,
      operation_type: "UPDATE_USER",
      target_type: "profiles",
      target_id: id,
      detail: `Updated user active status to ${is_active}`
    });

    res.json({ message: "User updated successfully" });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Reset password (Admin only)
app.post("/api/users/:id/reset-password", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  const operatorId = (req as any).user.id;

  try {
    const { error: authError } = await supabaseAdmin!.auth.admin.updateUserById(id, {
      password: newPassword
    });

    if (authError) throw authError;

    // Set must_change_password flag
    await supabaseAdmin!.from("profiles").update({ must_change_password: true, updated_at: new Date().toISOString() }).eq("id", id);

    await supabaseAdmin!.from("audit_logs").insert({
      operator_id: operatorId,
      operation_type: "RESET_PASSWORD",
      target_type: "profiles",
      target_id: id,
      detail: "Admin reset password for user"
    });

    res.json({ message: "Password reset successfully" });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete user (Admin only)
app.delete("/api/users/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const operatorId = (req as any).user.id;

  try {
    if (id === operatorId) {
      return res.status(400).json({ error: "You cannot delete your own account." });
    }

    // Check if this is the last admin
    const { data: targetProfile } = await supabaseAdmin!.from("profiles").select("role").eq("id", id).single();
    if (targetProfile?.role === 'admin') {
      const { count } = await supabaseAdmin!.from("profiles").select("id", { count: 'exact' }).eq("role", "admin");
      if (count === 1) {
        return res.status(400).json({ error: "Cannot delete the last admin account." });
      }
    }

    // Delete user
    const { error: deleteError } = await supabaseAdmin!.auth.admin.deleteUser(id);
    if (deleteError) throw deleteError;

    await supabaseAdmin!.from("audit_logs").insert({
      operator_id: operatorId,
      operation_type: "DELETE_USER",
      target_type: "profiles",
      target_id: id,
      detail: `Admin deleted user ID: ${id}`
    });

    res.json({ message: "User deleted successfully" });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get Audit Logs (Admin only)
app.get("/api/audit_logs", requireAdmin, async (req, res) => {
  const { data, error } = await supabaseAdmin!
    .from("audit_logs")
    .select(`
      *,
      operator:profiles(username)
    `)
    .order("created_at", { ascending: false })
    .limit(500);
    
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Get user claim status
app.get("/api/claim-status", async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not initialized" });
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No authorization header" });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { data: settingsData } = await supabaseAdmin
      .from("system_settings")
      .select("setting_value")
      .eq("setting_key", "follow_sale_rules")
      .single();
    
    const settings = settingsData?.setting_value || {};
    const minClaimThreshold = settings.daily_yes_threshold || 100;
    const dailyClaimLimit = settings.quantity_per_batch || 100;

    const { count: totalYes } = await supabaseAdmin
      .from("task_assignments")
      .select("id", { count: "exact" })
      .eq("assigned_user_id", user.id)
      .eq("judgment_result", "yes");

    const { count: totalClaimed } = await supabaseAdmin
      .from("user_product_library")
      .select("id", { count: "exact" })
      .eq("user_id", user.id);

    const today = new Date();
    today.setHours(0,0,0,0);
    const { count: claimedToday } = await supabaseAdmin
      .from("user_product_library")
      .select("id", { count: "exact" })
      .eq("user_id", user.id)
      .gte("received_at", today.toISOString());

    const totalYesCount = totalYes || 0;
    const totalClaimedCount = totalClaimed || 0;
    const claimedTodayCount = claimedToday || 0;

    const availableQuota = Math.max(0, totalYesCount - totalClaimedCount);
    
    res.json({
      totalYes: totalYesCount,
      totalClaimed: totalClaimedCount,
      claimedToday: claimedTodayCount,
      availableQuota,
      minClaimThreshold,
      dailyClaimLimit
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Claim follow sale products
app.post("/api/claim-products", async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not initialized" });
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No authorization header" });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { data: settingsData } = await supabaseAdmin
      .from("system_settings")
      .select("setting_value")
      .eq("setting_key", "follow_sale_rules")
      .single();
    
    const settings = settingsData?.setting_value || {};
    const minClaimThreshold = settings.daily_yes_threshold || 100;
    const dailyClaimLimit = settings.quantity_per_batch || 100;

    const { count: totalYes } = await supabaseAdmin
      .from("task_assignments")
      .select("id", { count: "exact" })
      .eq("assigned_user_id", user.id)
      .eq("judgment_result", "yes");

    const { count: totalClaimed } = await supabaseAdmin
      .from("user_product_library")
      .select("id", { count: "exact" })
      .eq("user_id", user.id);

    const today = new Date();
    today.setHours(0,0,0,0);
    const { count: claimedToday } = await supabaseAdmin
      .from("user_product_library")
      .select("id", { count: "exact" })
      .eq("user_id", user.id)
      .gte("received_at", today.toISOString());

    const totalYesCount = totalYes || 0;
    const totalClaimedCount = totalClaimed || 0;
    const claimedTodayCount = claimedToday || 0;

    const availableQuota = totalYesCount - totalClaimedCount;

    let claimAmount = Math.min(availableQuota, dailyClaimLimit - claimedTodayCount);

    if (claimAmount <= 0) {
      return res.status(400).json({ error: "今日可领取额度已耗尽，或没有可用额度。" });
    }

    // Call RPC to claim products
    const { data, error } = await supabaseAdmin.rpc("claim_follow_sale_products", {
      p_user_id: user.id,
      p_quantity: claimAmount
    });

    if (error) throw error;
    
    res.json({ claimedAmount: data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
