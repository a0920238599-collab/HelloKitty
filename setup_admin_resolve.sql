CREATE OR REPLACE FUNCTION public.resolve_disputed_product(p_product_id UUID, p_result TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_role TEXT;
BEGIN
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = auth.uid();
  IF v_admin_role != 'admin' THEN
    RAISE EXCEPTION '只有管理员可以进行最终裁决';
  END IF;

  UPDATE public.products
  SET judgment_status = p_result,
      judged_by = auth.uid(),
      judged_at = NOW()
  WHERE id = p_product_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
