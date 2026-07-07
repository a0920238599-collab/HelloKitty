CREATE OR REPLACE FUNCTION public.claim_follow_sale_products(p_user_id UUID, p_quantity INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_claimed_count INTEGER := 0;
  v_product_id UUID;
  v_batch_id UUID;
  v_daily_yes_count INTEGER;
  v_threshold INTEGER;
  v_max_qty INTEGER;
  v_rules JSONB;
BEGIN
  -- 1. 获取规则
  SELECT setting_value INTO v_rules FROM public.system_settings WHERE setting_key = 'follow_sale_rules';
  v_threshold := COALESCE((v_rules->>'daily_yes_threshold')::INTEGER, 100);
  v_max_qty := COALESCE((v_rules->>'quantity_per_batch')::INTEGER, 100);

  -- 不再限制批次，由传入的 quantity 决定本次领取数量
  IF p_quantity > v_max_qty THEN
    p_quantity := v_max_qty;
  END IF;

  -- 2. 检查当天判断为"是"的数量
  SELECT COUNT(*) INTO v_daily_yes_count
  FROM public.task_assignments
  WHERE assigned_user_id = p_user_id
    AND judgment_result = 'yes'
    AND status = 'submitted'
    AND submitted_at >= (NOW() AT TIME ZONE 'Asia/Shanghai')::DATE;

  IF v_daily_yes_count < v_threshold THEN
    RAISE EXCEPTION '当天判断为"是"的数量未达到要求 (%)', v_threshold;
  END IF;

  -- 4. 创建批次记录
  INSERT INTO public.follow_sale_export_batches (user_id, eligible_yes_count, requested_quantity, granted_quantity)
  VALUES (p_user_id, v_daily_yes_count, p_quantity, 0)
  RETURNING id INTO v_batch_id;

  -- 5. 抽取产品
  FOR v_product_id IN
    SELECT p.id 
    FROM public.products p
    WHERE p.judgment_status = 'yes'
      AND NOT EXISTS (
        SELECT 1 FROM public.user_product_library upl WHERE upl.product_id = p.id
      )
    ORDER BY random()
    LIMIT p_quantity
    FOR UPDATE SKIP LOCKED
  LOOP
    -- 插入到用户产品库
    INSERT INTO public.user_product_library (user_id, product_id, export_batch_id)
    VALUES (p_user_id, v_product_id, v_batch_id);

    v_claimed_count := v_claimed_count + 1;
  END LOOP;

  -- 6. 更新批次记录
  UPDATE public.follow_sale_export_batches
  SET granted_quantity = v_claimed_count
  WHERE id = v_batch_id;

  RETURN v_claimed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
