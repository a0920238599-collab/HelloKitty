-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 0. 用户和权限表 (Profiles)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  -- 如果邮箱以 admin@ 开头，或者系统目前没有 profiles，我们可以在后端 server 中处理管理员逻辑
  -- 这里的默认行为是将所有新用户视为 user
  INSERT INTO public.profiles (id, username, role)
  VALUES (new.id, COALESCE(new.email, new.id::TEXT), 'user');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile." ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ==========================================
-- 1. 表结构设计
-- ==========================================

-- 系统设置表 (仅管理员可修改)
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 产品表
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  erp_sku TEXT NOT NULL,
  erp_image_url TEXT NOT NULL,
  ozon_sku TEXT NOT NULL,
  ozon_image_url TEXT NOT NULL,
  usd_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  judgment_status TEXT NOT NULL DEFAULT 'unjudged' CHECK (judgment_status IN ('unjudged', 'yes', 'no')),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  judged_by UUID REFERENCES public.profiles(id),
  judged_at TIMESTAMPTZ,
  import_batch_id UUID,
  UNIQUE(erp_sku, ozon_sku)
);

-- 任务分配表
CREATE TABLE IF NOT EXISTS public.task_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  assigned_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'draft', 'submitted', 'reclaimed')),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  judgment_result TEXT CHECK (judgment_result IN ('yes', 'no', NULL)),
  judgment_note TEXT,
  reclaimed_by UUID REFERENCES public.profiles(id),
  reclaimed_at TIMESTAMPTZ,
  UNIQUE(product_id, assigned_user_id)
);

-- 确保同一产品不能同时有多个活跃的 claimed/draft 任务
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_task_per_product 
ON public.task_assignments (product_id) 
WHERE status IN ('claimed', 'draft');

-- 用户跟卖产品库
CREATE TABLE IF NOT EXISTS public.user_product_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'follow_sale',
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  export_batch_id UUID,
  UNIQUE(user_id, product_id)
);

-- 跟卖产品导出/领取批次表
CREATE TABLE IF NOT EXISTS public.follow_sale_export_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  eligible_yes_count INTEGER NOT NULL,
  requested_quantity INTEGER NOT NULL,
  granted_quantity INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 导入批次表
CREATE TABLE IF NOT EXISTS public.import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  imported_by UUID REFERENCES public.profiles(id),
  filename TEXT,
  total_rows INTEGER DEFAULT 0,
  success_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  skipped_rows INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 2. 触发器与自动更新时间
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 初始化系统设置
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES 
  ('follow_sale_rules', '{"daily_yes_threshold": 100, "daily_batch_limit": 1, "quantity_per_batch": 100}', '跟卖领取规则')
ON CONFLICT (setting_key) DO NOTHING;

-- ==========================================
-- 3. RPC 函数 (核心并发逻辑)
-- ==========================================

-- 函数：领取判断任务
CREATE OR REPLACE FUNCTION public.claim_judgment_tasks(p_user_id UUID, p_quantity INTEGER)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 函数：领取跟卖产品
CREATE OR REPLACE FUNCTION public.claim_follow_sale_products(p_user_id UUID, p_quantity INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_claimed_count INTEGER := 0;
  v_product_id UUID;
  v_batch_id UUID;
  v_daily_yes_count INTEGER;
  v_daily_batch_count INTEGER;
  v_threshold INTEGER;
  v_batch_limit INTEGER;
  v_max_qty INTEGER;
  v_rules JSONB;
BEGIN
  -- 1. 获取规则
  SELECT setting_value INTO v_rules FROM public.system_settings WHERE setting_key = 'follow_sale_rules';
  v_threshold := COALESCE((v_rules->>'daily_yes_threshold')::INTEGER, 100);
  v_batch_limit := COALESCE((v_rules->>'daily_batch_limit')::INTEGER, 1);
  v_max_qty := COALESCE((v_rules->>'quantity_per_batch')::INTEGER, 100);

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

  -- 3. 检查当天领取批次
  SELECT COUNT(*) INTO v_daily_batch_count
  FROM public.follow_sale_export_batches
  WHERE user_id = p_user_id
    AND created_at >= (NOW() AT TIME ZONE 'Asia/Shanghai')::DATE;

  IF v_daily_batch_count >= v_batch_limit THEN
    RAISE EXCEPTION '当天领取跟卖批次已达上限 (%)', v_batch_limit;
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
        SELECT 1 FROM public.user_product_library upl WHERE upl.product_id = p.id AND upl.user_id = p_user_id
      )
    ORDER BY random()
    LIMIT p_quantity
    FOR UPDATE SKIP LOCKED
  LOOP
    INSERT INTO public.user_product_library (user_id, product_id, export_batch_id)
    VALUES (p_user_id, v_product_id, v_batch_id);
    v_claimed_count := v_claimed_count + 1;
  END LOOP;

  -- 6. 更新批次数量
  UPDATE public.follow_sale_export_batches SET granted_quantity = v_claimed_count WHERE id = v_batch_id;

  RETURN v_claimed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 函数：提交判断结果
CREATE OR REPLACE FUNCTION public.submit_judgment(p_task_id UUID, p_result TEXT, p_note TEXT)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- 4. RLS 权限策略 (Row Level Security)
-- ==========================================

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_product_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_sale_export_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

-- 判断是否为管理员的辅助函数 (如果 setup.sql 中已有，可能需要 CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- System Settings
CREATE POLICY "Admins can manage system_settings" ON public.system_settings
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Products
CREATE POLICY "Admins can manage products" ON public.products
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 普通用户只能读取自己任务涉及的产品
CREATE POLICY "Users can read products related to their tasks" ON public.products
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.task_assignments WHERE product_id = products.id AND assigned_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_product_library WHERE product_id = products.id AND user_id = auth.uid())
  );

-- Task Assignments
CREATE POLICY "Admins can manage task_assignments" ON public.task_assignments
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Users can read and update own task_assignments" ON public.task_assignments
  FOR SELECT USING (assigned_user_id = auth.uid());
  
-- 用户更新任务 (仅限保存草稿，提交使用 RPC 函数确保原子性，但为了前端直接 update草稿，可以开放 UPDATE 权限给属于自己的 claimed/draft 任务)
CREATE POLICY "Users can update own unsubmitted tasks" ON public.task_assignments
  FOR UPDATE USING (assigned_user_id = auth.uid() AND status IN ('claimed', 'draft'))
  WITH CHECK (assigned_user_id = auth.uid() AND status IN ('claimed', 'draft'));

-- User Product Library
CREATE POLICY "Admins can manage user_product_library" ON public.user_product_library
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Users can read own user_product_library" ON public.user_product_library
  FOR SELECT USING (user_id = auth.uid());

-- Follow Sale Export Batches
CREATE POLICY "Admins can view follow_sale_export_batches" ON public.follow_sale_export_batches
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Users can read own follow_sale_export_batches" ON public.follow_sale_export_batches
  FOR SELECT USING (user_id = auth.uid());

-- Import Batches
CREATE POLICY "Admins can manage import_batches" ON public.import_batches
  USING (public.is_admin()) WITH CHECK (public.is_admin());

