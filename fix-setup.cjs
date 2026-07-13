const fs = require('fs');
let sql = fs.readFileSync('supabase/setup.sql', 'utf8');

// Replace claim_judgment_tasks
const claimTaskOriginal = `CREATE OR REPLACE FUNCTION public.claim_judgment_tasks(p_user_id UUID, p_quantity INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_claimed_count INTEGER := 0;
  v_product_id UUID;
BEGIN
  -- 查找符合条件的未判断产品，锁定行避免并发问题
  FOR v_product_id IN
    SELECT p.id 
    FROM public.products p
    WHERE p.judgment_status = 'unjudged'
      AND NOT EXISTS (
        SELECT 1 FROM public.task_assignments ta WHERE ta.product_id = p.id AND ta.status IN ('claimed', 'draft')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.task_assignments ta WHERE ta.product_id = p.id AND ta.assigned_user_id = p_user_id
      )
    ORDER BY random() -- 随机抽取
    LIMIT p_quantity
    FOR UPDATE SKIP LOCKED
  LOOP
    -- 插入任务
    INSERT INTO public.task_assignments (product_id, assigned_user_id, status)
    VALUES (v_product_id, p_user_id, 'claimed');
    v_claimed_count := v_claimed_count + 1;
  END LOOP;
  
  RETURN v_claimed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`;

const claimTaskNew = `CREATE OR REPLACE FUNCTION public.claim_judgment_tasks(p_user_id UUID, p_quantity INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_claimed_count INTEGER := 0;
  v_product_id UUID;
BEGIN
  -- 查找符合条件的未判断产品，锁定行避免并发问题
  FOR v_product_id IN
    SELECT p.id 
    FROM public.products p
    WHERE p.judgment_status = 'unjudged'
      AND NOT EXISTS (
        SELECT 1 FROM public.task_assignments ta WHERE ta.product_id = p.id AND ta.status IN ('claimed', 'draft')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.task_assignments ta WHERE ta.product_id = p.id AND ta.assigned_user_id = p_user_id
      )
    ORDER BY random() -- 随机抽取
    LIMIT p_quantity
    FOR UPDATE SKIP LOCKED
  LOOP
    -- 插入任务
    INSERT INTO public.task_assignments (product_id, assigned_user_id, status)
    VALUES (v_product_id, p_user_id, 'claimed');
    v_claimed_count := v_claimed_count + 1;
  END LOOP;
  
  -- 如果公共数据库的产品都判断完了（或者不够本次领取的数量），
  -- 那么就把之前判断为是的产品重新发给用户判断一遍称之为二次/三次判断
  IF v_claimed_count < p_quantity THEN
    FOR v_product_id IN
      SELECT p.id
      FROM public.products p
      WHERE p.judgment_status = 'yes'
        AND NOT EXISTS (
          SELECT 1 FROM public.task_assignments ta WHERE ta.product_id = p.id AND ta.status IN ('claimed', 'draft')
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.task_assignments ta WHERE ta.product_id = p.id AND ta.assigned_user_id = p_user_id
        )
      ORDER BY random()
      LIMIT (p_quantity - v_claimed_count)
      FOR UPDATE SKIP LOCKED
    LOOP
      INSERT INTO public.task_assignments (product_id, assigned_user_id, status)
      VALUES (v_product_id, p_user_id, 'claimed');
      v_claimed_count := v_claimed_count + 1;
    END LOOP;
  END IF;

  RETURN v_claimed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`;

const submitTaskOriginal = `CREATE OR REPLACE FUNCTION public.submit_judgment(p_task_id UUID, p_result TEXT, p_note TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_product_id UUID;
  v_status TEXT;
  v_user_id UUID;
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

  -- 更新任务表
  UPDATE public.task_assignments
  SET status = 'submitted',
      judgment_result = p_result,
      judgment_note = p_note,
      submitted_at = NOW()
  WHERE id = p_task_id;

  -- 更新产品表
  UPDATE public.products
  SET judgment_status = p_result,
      judged_by = auth.uid(),
      judged_at = NOW()
  WHERE id = v_product_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`;

const submitTaskNew = `CREATE OR REPLACE FUNCTION public.submit_judgment(p_task_id UUID, p_result TEXT, p_note TEXT)
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

  -- 更新产品表：如果原来是 yes，现在是 no，则变为 disputed
  -- （只有原来是 yes 或者 unjudged 的产品会被分配任务）
  IF v_current_prod_status = 'yes' AND p_result = 'no' THEN
    UPDATE public.products
    SET judgment_status = 'disputed',
        judged_by = auth.uid(),
        judged_at = NOW()
    WHERE id = v_product_id;
  ELSIF v_current_prod_status = 'disputed' THEN
    -- 如果在提交前已经是存疑，保持不变（即领取到了就领取到，但不改变存疑状态）
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
$$ LANGUAGE plpgsql SECURITY DEFINER;`;

sql = sql.replace(claimTaskOriginal, claimTaskNew);
sql = sql.replace(submitTaskOriginal, submitTaskNew);

fs.writeFileSync('supabase/setup.sql', sql);
