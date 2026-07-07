-- 请复制以下所有内容，粘贴到 Supabase 的 SQL Editor 中并点击 RUN (执行)
CREATE OR REPLACE FUNCTION get_user_judgment_stats()
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  today_count BIGINT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS user_id,
    p.username,
    COUNT(t.id) FILTER (WHERE t.status = 'submitted' AND t.submitted_at >= CURRENT_DATE)::BIGINT AS today_count,
    COUNT(t.id) FILTER (WHERE t.status = 'submitted')::BIGINT AS total_count
  FROM profiles p
  LEFT JOIN task_assignments t ON p.id = t.assigned_user_id
  WHERE p.role = 'user'
  GROUP BY p.id, p.username
  ORDER BY total_count DESC;
END;
$$;
