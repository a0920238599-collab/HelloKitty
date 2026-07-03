-- Allow authenticated users to view system settings
CREATE POLICY "Allow authenticated to view system settings" ON system_settings FOR SELECT TO authenticated USING (true);

-- Ensure the RPC is executable by authenticated users
GRANT EXECUTE ON FUNCTION claim_follow_sale_products(uuid, integer) TO authenticated;
