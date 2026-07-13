-- 1. 重新创建 is_admin 辅助函数
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN COALESCE(v_role = 'admin', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 重新创建管理员裁定函数
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

-- 3. 重新创建用户提交判断的函数
CREATE OR REPLACE FUNCTION public.submit_judgment(p_task_id UUID, p_result TEXT, p_note TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_product_id UUID;
  v_status TEXT;
  v_user_id UUID;
  v_current_prod_status TEXT;
BEGIN
  -- 获取任务信息并锁定
  SELECT product_id, status, assigned_user_id INTO v_product_id, v_status, v_user_id
  FROM public.task_assignments
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '任务不存在';
  END IF;

  IF v_user_id != auth.uid() THEN
    RAISE EXCEPTION '只能提交自己的任务';
  END IF;

  IF v_status = 'submitted' THEN
    RAISE EXCEPTION '任务已提交，不可修改';
  END IF;
  
  SELECT judgment_status INTO v_current_prod_status
  FROM public.products
  WHERE id = v_product_id
  FOR UPDATE;

  -- 更新任务表
  UPDATE public.task_assignments
  SET status = 'submitted',
      judgment_result = p_result,
      judgment_note = p_note,
      submitted_at = NOW()
  WHERE id = p_task_id;

  -- 更新产品表逻辑：二次判断如果是 yes -> no 则存疑
  IF v_current_prod_status = 'yes' AND p_result = 'no' THEN
    UPDATE public.products
    SET judgment_status = 'disputed',
        judged_by = auth.uid(),
        judged_at = NOW()
    WHERE id = v_product_id;
  ELSIF v_current_prod_status = 'disputed' THEN
    -- 如果已经是存疑状态，则只更新判断人和时间，状态保持为存疑
    UPDATE public.products
    SET judged_by = auth.uid(),
        judged_at = NOW()
    WHERE id = v_product_id;
  ELSE
    UPDATE public.products
    SET judgment_status = p_result,
        judged_by = auth.uid(),
        judged_at = NOW()
    WHERE id = v_product_id;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
