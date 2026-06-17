-- ============================================================
-- CONSOLIDATED SCHEMA MIGRATION
-- Run this entire file in your new Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New Query -> paste -> Run)
-- ============================================================


-- ---------- 20260416232424_408833b7-a088-4eab-b44d-ba5874e462a3.sql ----------

-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'kitchen');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','kitchen'))
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- CATEGORIES
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- MENU ITEMS
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_veg BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads menu" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "Admins manage menu" ON public.menu_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_menu_items_updated BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TABLES (restaurant tables)
CREATE TABLE public.restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number INT NOT NULL UNIQUE,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads tables" ON public.restaurant_tables FOR SELECT USING (true);
CREATE POLICY "Admins manage tables" ON public.restaurant_tables FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ORDERS
CREATE TYPE public.order_status AS ENUM ('pending','preparing','ready','served','cancelled');

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number INT NOT NULL,
  customer_name TEXT,
  status public.order_status NOT NULL DEFAULT 'pending',
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  payment_method TEXT,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can create order" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone reads orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Staff updates orders" ON public.orders FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admins delete orders" ON public.orders FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ORDER ITEMS
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can create order items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone reads order items" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "Admins delete order items" ON public.order_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- FEEDBACK
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  table_number INT,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit feedback" ON public.feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff reads feedback" ON public.feedback FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- Storage bucket for menu images
INSERT INTO storage.buckets (id, name, public) VALUES ('menu-images','menu-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read menu images" ON storage.objects FOR SELECT USING (bucket_id = 'menu-images');
CREATE POLICY "Admins upload menu images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='menu-images' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update menu images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='menu-images' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete menu images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='menu-images' AND public.has_role(auth.uid(),'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER TABLE public.menu_items REPLICA IDENTITY FULL;

-- ---------- 20260417004943_95515fc8-18a2-4132-b77f-2e1d29d2dd3e.sql ----------

-- 1. Reset password for hello@gmail.com to "Hello@123"
UPDATE auth.users
SET 
  encrypted_password = crypt('Hello@123', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now()
WHERE email = 'hello@gmail.com';

-- 2. Grant admin role (idempotent)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'hello@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- ---------- 20260417010108_3ec2733a-9298-4297-a23e-17133f94467d.sql ----------

-- Add variants to menu items (e.g. [{"label":"Regular","price":120},{"label":"Large","price":180}])
ALTER TABLE public.menu_items
ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Add chosen variant label on order_items so kitchen sees "Chicken Popcorn (Large)"
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS variant_label text;

-- Enable realtime for orders + order_items so kitchen can subscribe
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.orders';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_items'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items';
  END IF;
END $$;

-- ---------- 20260418055433_663f60c4-9b36-492e-8bfc-65b76edd882b.sql ----------

-- 1. Table sessions
CREATE TABLE public.table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX idx_table_sessions_active ON public.table_sessions (table_number) WHERE status = 'active';

ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads sessions" ON public.table_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone creates session" ON public.table_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff updates sessions" ON public.table_sessions FOR UPDATE
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admins delete sessions" ON public.table_sessions FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Orders: session_id + is_rush + idempotency_key
ALTER TABLE public.orders
  ADD COLUMN session_id UUID REFERENCES public.table_sessions(id) ON DELETE SET NULL,
  ADD COLUMN is_rush BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX idx_orders_idempotency ON public.orders (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_orders_session ON public.orders (session_id);

-- 3. Auto-close session when ALL its orders are paid
CREATE OR REPLACE FUNCTION public.maybe_close_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  unpaid_count INTEGER;
BEGIN
  IF NEW.session_id IS NULL OR NEW.is_paid = false THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO unpaid_count
  FROM public.orders
  WHERE session_id = NEW.session_id AND is_paid = false;

  IF unpaid_count = 0 THEN
    UPDATE public.table_sessions
       SET status = 'closed', closed_at = now()
     WHERE id = NEW.session_id AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_maybe_close_session
AFTER UPDATE OF is_paid ON public.orders
FOR EACH ROW
WHEN (NEW.is_paid = true)
EXECUTE FUNCTION public.maybe_close_session();

-- 4. Waiter calls
CREATE TABLE public.waiter_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number INTEGER NOT NULL,
  session_id UUID REFERENCES public.table_sessions(id) ON DELETE SET NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_waiter_calls_pending ON public.waiter_calls (created_at DESC) WHERE status = 'pending';

ALTER TABLE public.waiter_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone creates waiter call" ON public.waiter_calls FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff reads waiter calls" ON public.waiter_calls FOR SELECT
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff updates waiter calls" ON public.waiter_calls FOR UPDATE
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admins delete waiter calls" ON public.waiter_calls FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.waiter_calls;
ALTER TABLE public.table_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.waiter_calls REPLICA IDENTITY FULL;

-- ---------- 20260426112615_d385f375-a62d-4ba7-bef2-781d4021ca02.sql ----------

-- 1) Per-item prepared flag (kitchen tick)
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS is_prepared boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prepared_at timestamptz;

-- 2) Mark when an order received an appended batch (for "new items" highlight)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS last_appended_at timestamptz;

-- 3) RPC: append items to an existing open order atomically (or create a new one).
--    Uses SECURITY DEFINER so anonymous customers can update order totals safely.
CREATE OR REPLACE FUNCTION public.append_order_items(
  _table_number int,
  _session_id uuid,
  _customer_name text,
  _notes text,
  _added_total numeric,
  _items jsonb,
  _idempotency_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_existing_total numeric;
BEGIN
  -- Idempotency short-circuit
  SELECT id INTO v_order_id FROM public.orders WHERE idempotency_key = _idempotency_key LIMIT 1;
  IF v_order_id IS NOT NULL THEN
    RETURN v_order_id;
  END IF;

  -- Try to find an existing open order for this session
  IF _session_id IS NOT NULL THEN
    SELECT id, total INTO v_order_id, v_existing_total
    FROM public.orders
    WHERE session_id = _session_id
      AND is_paid = false
      AND status IN ('pending','preparing','ready')
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_order_id IS NULL THEN
    INSERT INTO public.orders (table_number, session_id, customer_name, notes, total, idempotency_key)
    VALUES (_table_number, _session_id, _customer_name, _notes, _added_total, _idempotency_key)
    RETURNING id INTO v_order_id;
  ELSE
    UPDATE public.orders
       SET total = COALESCE(v_existing_total, 0) + _added_total,
           last_appended_at = now(),
           updated_at = now(),
           idempotency_key = _idempotency_key
     WHERE id = v_order_id;
  END IF;

  -- Insert items
  INSERT INTO public.order_items (order_id, menu_item_id, name, variant_label, unit_price, quantity)
  SELECT v_order_id,
         NULLIF(item->>'menu_item_id','')::uuid,
         item->>'name',
         item->>'variant_label',
         (item->>'unit_price')::numeric,
         (item->>'quantity')::int
  FROM jsonb_array_elements(_items) AS item;

  RETURN v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.append_order_items(int, uuid, text, text, numeric, jsonb, text) TO anon, authenticated;

-- 4) RPC: staff toggle a single item prepared; auto-mark order served if all prepared.
CREATE OR REPLACE FUNCTION public.set_item_prepared(_item_id uuid, _prepared boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_remaining int;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public.order_items
     SET is_prepared = _prepared,
         prepared_at = CASE WHEN _prepared THEN now() ELSE NULL END
   WHERE id = _item_id
   RETURNING order_id INTO v_order_id;

  IF v_order_id IS NULL THEN RETURN; END IF;

  -- Recompute order status from item ticks
  SELECT COUNT(*) INTO v_remaining
  FROM public.order_items
  WHERE order_id = v_order_id AND is_prepared = false;

  IF v_remaining = 0 THEN
    UPDATE public.orders SET status = 'served', updated_at = now()
     WHERE id = v_order_id AND status <> 'served';
  ELSIF _prepared THEN
    -- some prepared, some not -> ensure status at least 'preparing'
    UPDATE public.orders SET status = 'preparing', updated_at = now()
     WHERE id = v_order_id AND status = 'pending';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_item_prepared(uuid, boolean) TO authenticated;

-- ---------- 20260428074922_108117f3-4734-42a3-b843-3b488dc14a24.sql ----------

-- Make append_order_items recompute total from order_items (source of truth)
-- This eliminates any drift between orders.total and the actual line items.

CREATE OR REPLACE FUNCTION public.append_order_items(
  _table_number integer,
  _session_id uuid,
  _customer_name text,
  _notes text,
  _added_total numeric,
  _items jsonb,
  _idempotency_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_new_total numeric;
BEGIN
  -- Idempotency short-circuit
  SELECT id INTO v_order_id FROM public.orders WHERE idempotency_key = _idempotency_key LIMIT 1;
  IF v_order_id IS NOT NULL THEN
    RETURN v_order_id;
  END IF;

  -- Try to find an existing open order for this session
  IF _session_id IS NOT NULL THEN
    SELECT id INTO v_order_id
    FROM public.orders
    WHERE session_id = _session_id
      AND is_paid = false
      AND status IN ('pending','preparing','ready')
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_order_id IS NULL THEN
    INSERT INTO public.orders (table_number, session_id, customer_name, notes, total, idempotency_key)
    VALUES (_table_number, _session_id, _customer_name, _notes, _added_total, _idempotency_key)
    RETURNING id INTO v_order_id;
  END IF;

  -- Insert the new items
  INSERT INTO public.order_items (order_id, menu_item_id, name, variant_label, unit_price, quantity)
  SELECT v_order_id,
         NULLIF(item->>'menu_item_id','')::uuid,
         item->>'name',
         item->>'variant_label',
         (item->>'unit_price')::numeric,
         (item->>'quantity')::int
  FROM jsonb_array_elements(_items) AS item;

  -- Recompute total from line items (source of truth — never stale)
  SELECT COALESCE(SUM(unit_price * quantity), 0)
    INTO v_new_total
    FROM public.order_items
   WHERE order_id = v_order_id;

  UPDATE public.orders
     SET total = v_new_total,
         last_appended_at = now(),
         updated_at = now(),
         idempotency_key = _idempotency_key
   WHERE id = v_order_id;

  RETURN v_order_id;
END;
$function$;

-- ---------- 20260428081430_6fd00b0d-8f45-4fb3-a238-52d50a782754.sql ----------

-- 1) App settings singleton (admin-controlled feature flags)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  require_order_otp boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.app_settings (id, require_order_otp)
VALUES (true, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads settings" ON public.app_settings;
CREATE POLICY "Anyone reads settings"
  ON public.app_settings FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admins update settings" ON public.app_settings;
CREATE POLICY "Admins update settings"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Add OTP columns to orders for staff-verified placement
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS staff_otp text,
  ADD COLUMN IF NOT EXISTS otp_verified boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS otp_issued_at timestamp with time zone;

-- 3) Update append_order_items to honor OTP requirement
CREATE OR REPLACE FUNCTION public.append_order_items(
  _table_number integer,
  _session_id uuid,
  _customer_name text,
  _notes text,
  _added_total numeric,
  _items jsonb,
  _idempotency_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_new_total numeric;
  v_require_otp boolean;
  v_otp text;
BEGIN
  -- Idempotency short-circuit
  SELECT id INTO v_order_id FROM public.orders WHERE idempotency_key = _idempotency_key LIMIT 1;
  IF v_order_id IS NOT NULL THEN
    RETURN v_order_id;
  END IF;

  -- Require name
  IF _customer_name IS NULL OR length(btrim(_customer_name)) = 0 THEN
    RAISE EXCEPTION 'name_required';
  END IF;

  SELECT require_order_otp INTO v_require_otp FROM public.app_settings WHERE id = true;
  v_require_otp := COALESCE(v_require_otp, false);

  -- Try to find an existing open & verified order for this session
  IF _session_id IS NOT NULL THEN
    SELECT id INTO v_order_id
    FROM public.orders
    WHERE session_id = _session_id
      AND is_paid = false
      AND otp_verified = true
      AND status IN ('pending','preparing','ready')
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_order_id IS NULL THEN
    IF v_require_otp THEN
      v_otp := lpad(floor(random() * 10000)::int::text, 4, '0');
    END IF;
    INSERT INTO public.orders (
      table_number, session_id, customer_name, notes, total, idempotency_key,
      staff_otp, otp_verified, otp_issued_at
    )
    VALUES (
      _table_number, _session_id, _customer_name, _notes, _added_total, _idempotency_key,
      v_otp, NOT v_require_otp, CASE WHEN v_require_otp THEN now() ELSE NULL END
    )
    RETURNING id INTO v_order_id;
  END IF;

  -- Insert the new items
  INSERT INTO public.order_items (order_id, menu_item_id, name, variant_label, unit_price, quantity)
  SELECT v_order_id,
         NULLIF(item->>'menu_item_id','')::uuid,
         item->>'name',
         item->>'variant_label',
         (item->>'unit_price')::numeric,
         (item->>'quantity')::int
  FROM jsonb_array_elements(_items) AS item;

  -- Recompute total (source of truth)
  SELECT COALESCE(SUM(unit_price * quantity), 0)
    INTO v_new_total
    FROM public.order_items
   WHERE order_id = v_order_id;

  UPDATE public.orders
     SET total = v_new_total,
         last_appended_at = now(),
         updated_at = now(),
         idempotency_key = _idempotency_key
   WHERE id = v_order_id;

  RETURN v_order_id;
END;
$function$;

-- 4) Staff verification RPC
CREATE OR REPLACE FUNCTION public.verify_order_otp(_order_id uuid, _code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_stored text;
  v_verified boolean;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT staff_otp, otp_verified INTO v_stored, v_verified
    FROM public.orders WHERE id = _order_id;

  IF v_verified THEN RETURN true; END IF;
  IF v_stored IS NULL OR _code IS NULL OR btrim(_code) <> v_stored THEN
    RETURN false;
  END IF;

  UPDATE public.orders
     SET otp_verified = true,
         updated_at = now()
   WHERE id = _order_id;

  RETURN true;
END;
$function$;

-- ---------- 20260430091649_ba4c3b94-d56d-4a27-94c5-04577d68f6d1.sql ----------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pro_admin' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'pro_admin';
  END IF;
END $$;

-- ---------- 20260430091726_f78c86de-48c1-48d4-8254-8a654d6a28ef.sql ----------

-- Ordering mode
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS ordering_mode text NOT NULL DEFAULT 'qr';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='app_settings_ordering_mode_chk') THEN
    ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_ordering_mode_chk CHECK (ordering_mode IN ('qr','waiter'));
  END IF;
END $$;

-- Pro admin can manage like admin
DROP POLICY IF EXISTS "Admins update settings" ON public.app_settings;
CREATE POLICY "Admins or pro update settings"
ON public.app_settings FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'pro_admin'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'pro_admin'));

DROP POLICY IF EXISTS "Admins manage categories" ON public.categories;
CREATE POLICY "Admins or pro manage categories"
ON public.categories FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'pro_admin'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'pro_admin'));

-- Pro admin can also manage roles (so they can grant admin/kitchen)
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins or pro manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'pro_admin'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'pro_admin'));

DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;
CREATE POLICY "Admins or pro view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'pro_admin') OR user_id = auth.uid());

-- Cancel order RPC
CREATE OR REPLACE FUNCTION public.cancel_order(_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  UPDATE public.orders SET status='cancelled', updated_at=now() WHERE id=_order_id;
END $$;

-- Waiter place order RPC
CREATE OR REPLACE FUNCTION public.waiter_place_order(
  _table_number int, _customer_name text, _notes text, _items jsonb, _idempotency_key text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_total numeric;
  v_session_id uuid;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  SELECT id INTO v_order_id FROM public.orders WHERE idempotency_key=_idempotency_key LIMIT 1;
  IF v_order_id IS NOT NULL THEN RETURN v_order_id; END IF;

  SELECT id INTO v_session_id FROM public.table_sessions
    WHERE table_number=_table_number AND status='active'
    ORDER BY created_at DESC LIMIT 1;
  IF v_session_id IS NULL THEN
    INSERT INTO public.table_sessions(table_number) VALUES (_table_number) RETURNING id INTO v_session_id;
  END IF;

  SELECT id INTO v_order_id FROM public.orders
   WHERE session_id=v_session_id AND is_paid=false AND otp_verified=true
     AND status IN ('pending','preparing','ready')
   ORDER BY created_at DESC LIMIT 1 FOR UPDATE;

  IF v_order_id IS NULL THEN
    INSERT INTO public.orders(table_number, session_id, customer_name, notes, total, idempotency_key, otp_verified)
    VALUES (_table_number, v_session_id, NULLIF(btrim(_customer_name),''), _notes, 0, _idempotency_key, true)
    RETURNING id INTO v_order_id;
  END IF;

  INSERT INTO public.order_items(order_id, menu_item_id, name, variant_label, unit_price, quantity)
  SELECT v_order_id,
         NULLIF(item->>'menu_item_id','')::uuid,
         item->>'name',
         item->>'variant_label',
         (item->>'unit_price')::numeric,
         (item->>'quantity')::int
  FROM jsonb_array_elements(_items) AS item;

  SELECT COALESCE(SUM(unit_price*quantity),0) INTO v_total
    FROM public.order_items WHERE order_id=v_order_id;

  UPDATE public.orders SET total=v_total, last_appended_at=now(), updated_at=now(), idempotency_key=_idempotency_key
   WHERE id=v_order_id;

  RETURN v_order_id;
END $$;

-- ---------- 20260502125121_84b55458-6582-4459-b07a-3667cb5736c7.sql ----------


CREATE TABLE IF NOT EXISTS public.monthly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  label text NOT NULL,
  total_revenue numeric NOT NULL DEFAULT 0,
  total_orders integer NOT NULL DEFAULT 0,
  total_items integer NOT NULL DEFAULT 0,
  avg_order_value numeric NOT NULL DEFAULT 0,
  overall jsonb NOT NULL DEFAULT '{}'::jsonb,
  item_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (period_start, period_end)
);

ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read monthly reports"
  ON public.monthly_reports FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pro_admin'));

CREATE POLICY "Staff insert monthly reports"
  ON public.monthly_reports FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pro_admin'));

CREATE POLICY "Staff delete monthly reports"
  ON public.monthly_reports FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pro_admin'));


-- ---------- 20260502155544_72a1b0da-baee-4eaf-8248-300ee2a3a52d.sql ----------

-- Allow public (anonymous) writes to app_settings and categories for the hidden /nzzht panel
DROP POLICY IF EXISTS "Admins or pro update settings" ON public.app_settings;
CREATE POLICY "Anyone updates settings" ON public.app_settings FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins or pro manage categories" ON public.categories;
CREATE POLICY "Anyone manages categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);

-- ---------- 20260502170708_a177fe61-0a59-441f-a30c-01d4f8bf87ec.sql ----------

CREATE OR REPLACE FUNCTION public.append_order_items(_table_number integer, _session_id uuid, _customer_name text, _notes text, _added_total numeric, _items jsonb, _idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_new_total numeric;
  v_require_otp boolean;
  v_otp text;
BEGIN
  SELECT id INTO v_order_id FROM public.orders WHERE idempotency_key = _idempotency_key LIMIT 1;
  IF v_order_id IS NOT NULL THEN
    RETURN v_order_id;
  END IF;

  IF _customer_name IS NULL OR length(btrim(_customer_name)) = 0 THEN
    RAISE EXCEPTION 'name_required';
  END IF;

  SELECT require_order_otp INTO v_require_otp FROM public.app_settings WHERE id = true;
  v_require_otp := COALESCE(v_require_otp, false);

  -- Reuse any open order for this session (verified OR still pending verification)
  IF _session_id IS NOT NULL THEN
    SELECT id INTO v_order_id
    FROM public.orders
    WHERE session_id = _session_id
      AND is_paid = false
      AND status IN ('pending','preparing','ready')
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_order_id IS NULL THEN
    IF v_require_otp THEN
      v_otp := lpad(floor(random() * 10000)::int::text, 4, '0');
    END IF;
    INSERT INTO public.orders (
      table_number, session_id, customer_name, notes, total, idempotency_key,
      staff_otp, otp_verified, otp_issued_at
    )
    VALUES (
      _table_number, _session_id, _customer_name, _notes, _added_total, _idempotency_key,
      v_otp, NOT v_require_otp, CASE WHEN v_require_otp THEN now() ELSE NULL END
    )
    RETURNING id INTO v_order_id;
  END IF;

  INSERT INTO public.order_items (order_id, menu_item_id, name, variant_label, unit_price, quantity)
  SELECT v_order_id,
         NULLIF(item->>'menu_item_id','')::uuid,
         item->>'name',
         item->>'variant_label',
         (item->>'unit_price')::numeric,
         (item->>'quantity')::int
  FROM jsonb_array_elements(_items) AS item;

  SELECT COALESCE(SUM(unit_price * quantity), 0)
    INTO v_new_total
    FROM public.order_items
   WHERE order_id = v_order_id;

  UPDATE public.orders
     SET total = v_new_total,
         last_appended_at = now(),
         updated_at = now(),
         idempotency_key = _idempotency_key
   WHERE id = v_order_id;

  RETURN v_order_id;
END;
$function$;

-- ============================================================
-- REALTIME: enable live updates on tables the app subscribes to
-- ============================================================
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER TABLE public.waiter_calls REPLICA IDENTITY FULL;
ALTER TABLE public.app_settings REPLICA IDENTITY FULL;
ALTER TABLE public.table_sessions REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.orders; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.waiter_calls; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.table_sessions; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ============================================================
-- STORAGE: create the menu-images bucket (public read)
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('menu-images','menu-images',true) ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  BEGIN
    CREATE POLICY "Public read menu-images" ON storage.objects FOR SELECT USING (bucket_id='menu-images');
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    CREATE POLICY "Admins upload menu-images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='menu-images' AND public.has_role(auth.uid(),'admin'));
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    CREATE POLICY "Admins update menu-images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='menu-images' AND public.has_role(auth.uid(),'admin'));
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    CREATE POLICY "Admins delete menu-images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='menu-images' AND public.has_role(auth.uid(),'admin'));
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ---------- 20260513072100_kitchen_extras.sql (latest) ----------

-- 1) Allow kitchen to add extra items (Extra sauce, packing, etc.) and flag them visibly.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS added_by_kitchen boolean NOT NULL DEFAULT false;

-- 2) Allow staff (admin / kitchen) to UPDATE order_items so they can change qty,
--    mark prepared, or correct typos. Customers still cannot UPDATE.
DROP POLICY IF EXISTS "Staff updates order items" ON public.order_items;
CREATE POLICY "Staff updates order items"
  ON public.order_items FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- 3) Make sure realtime is on for the new column / policy effects.
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;      EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.waiter_calls;  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.table_sessions; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ---------- 20260514142951_app_settings_insert_policy.sql ----------

-- Ensure a default row exists in app_settings (toggles upsert against id=true).
INSERT INTO public.app_settings (id, require_order_otp, ordering_mode)
VALUES (true, false, 'qr')
ON CONFLICT (id) DO NOTHING;

-- Allow public INSERT so upsert from /nzzht and admin works even on a fresh DB.
DROP POLICY IF EXISTS "Anyone inserts settings" ON public.app_settings;
CREATE POLICY "Anyone inserts settings"
  ON public.app_settings FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- v2026.05.15 — Combos, Specials, Announcements, Hidden categories, Uploads
-- Idempotent — safe to re-run.
-- ============================================================================

ALTER TABLE public.categories  ADD COLUMN IF NOT EXISTS is_hidden     boolean NOT NULL DEFAULT false;
ALTER TABLE public.menu_items  ADD COLUMN IF NOT EXISTS is_special    boolean NOT NULL DEFAULT false;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS show_specials boolean NOT NULL DEFAULT true;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS show_combos   boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.combos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  original_price numeric NOT NULL DEFAULT 0,
  offer_price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_special boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads active combos" ON public.combos;
CREATE POLICY "Anyone reads active combos" ON public.combos FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Admins manage combos" ON public.combos;
CREATE POLICY "Admins manage combos" ON public.combos FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP TRIGGER IF EXISTS combos_set_updated_at ON public.combos;
CREATE TRIGGER combos_set_updated_at BEFORE UPDATE ON public.combos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.combo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id uuid NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_combo_items_combo ON public.combo_items(combo_id);
ALTER TABLE public.combo_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads combo items" ON public.combo_items;
CREATE POLICY "Anyone reads combo items" ON public.combo_items FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Admins manage combo items" ON public.combo_items;
CREATE POLICY "Admins manage combo items" ON public.combo_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads announcements" ON public.announcements;
CREATE POLICY "Anyone reads announcements" ON public.announcements FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Admins manage announcements" ON public.announcements;
CREATE POLICY "Admins manage announcements" ON public.announcements FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP TRIGGER IF EXISTS announcements_set_updated_at ON public.announcements;
CREATE TRIGGER announcements_set_updated_at BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.combos;        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.combo_items;   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO storage.buckets (id, name, public) VALUES ('menu-images','menu-images',true)
  ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "menu-images public read"           ON storage.objects;
DROP POLICY IF EXISTS "menu-images authenticated insert"  ON storage.objects;
DROP POLICY IF EXISTS "menu-images authenticated update"  ON storage.objects;
DROP POLICY IF EXISTS "menu-images authenticated delete"  ON storage.objects;
CREATE POLICY "menu-images public read"          ON storage.objects FOR SELECT TO public        USING (bucket_id = 'menu-images');
CREATE POLICY "menu-images authenticated insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'menu-images');
CREATE POLICY "menu-images authenticated update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'menu-images') WITH CHECK (bucket_id = 'menu-images');
CREATE POLICY "menu-images authenticated delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'menu-images');


-- ---------- 20260516144359_robust_order_identity.sql ----------

-- Robust same-table order separation by normalized customer name.
-- No data is deleted or moved.

CREATE INDEX IF NOT EXISTS idx_orders_open_session_customer_name
ON public.orders (
  session_id,
  lower(regexp_replace(btrim(coalesce(customer_name, '')), '\s+', ' ', 'g')),
  created_at DESC
)
WHERE is_paid = false AND status IN ('pending','preparing','ready');

CREATE INDEX IF NOT EXISTS idx_orders_open_table_customer_name
ON public.orders (
  table_number,
  lower(regexp_replace(btrim(coalesce(customer_name, '')), '\s+', ' ', 'g')),
  created_at DESC
)
WHERE is_paid = false AND status IN ('pending','preparing','ready');

CREATE OR REPLACE FUNCTION public.append_order_items(
  _table_number integer,
  _session_id uuid,
  _customer_name text,
  _notes text,
  _added_total numeric,
  _items jsonb,
  _idempotency_key text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_new_total numeric;
  v_require_otp boolean;
  v_otp text;
  v_session_id uuid := _session_id;
  v_name text := NULLIF(regexp_replace(btrim(coalesce(_customer_name, '')), '\s+', ' ', 'g'), '');
  v_name_key text;
BEGIN
  SELECT id INTO v_order_id
  FROM public.orders
  WHERE idempotency_key = _idempotency_key
  LIMIT 1;

  IF v_order_id IS NOT NULL THEN
    RETURN v_order_id;
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'name_required';
  END IF;

  v_name_key := lower(v_name);

  -- Serialize only this exact table/session/name lane. Different names do not block or merge.
  PERFORM pg_advisory_xact_lock(hashtextextended('customer-order:' || coalesce(v_session_id::text, 'table-' || _table_number::text) || ':' || v_name_key, 0));

  SELECT require_order_otp INTO v_require_otp
  FROM public.app_settings
  WHERE id = true;
  v_require_otp := COALESCE(v_require_otp, false);

  -- Primary match: same active session + same normalized customer name.
  IF v_session_id IS NOT NULL THEN
    SELECT id INTO v_order_id
    FROM public.orders
    WHERE session_id = v_session_id
      AND is_paid = false
      AND status IN ('pending','preparing','ready')
      AND lower(regexp_replace(btrim(coalesce(customer_name, '')), '\s+', ' ', 'g')) = v_name_key
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  -- Fallback for older/null-session rows: same table + same normalized customer name only.
  -- This never merges different names.
  IF v_order_id IS NULL AND v_session_id IS NULL THEN
    SELECT id INTO v_order_id
    FROM public.orders
    WHERE table_number = _table_number
      AND session_id IS NULL
      AND is_paid = false
      AND status IN ('pending','preparing','ready')
      AND lower(regexp_replace(btrim(coalesce(customer_name, '')), '\s+', ' ', 'g')) = v_name_key
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_order_id IS NULL THEN
    IF v_require_otp THEN
      v_otp := lpad(floor(random() * 10000)::int::text, 4, '0');
    END IF;

    INSERT INTO public.orders (
      table_number, session_id, customer_name, notes, total, idempotency_key,
      staff_otp, otp_verified, otp_issued_at
    ) VALUES (
      _table_number, v_session_id, v_name, _notes, _added_total, _idempotency_key,
      v_otp, NOT v_require_otp, CASE WHEN v_require_otp THEN now() ELSE NULL END
    )
    RETURNING id INTO v_order_id;
  END IF;

  INSERT INTO public.order_items (order_id, menu_item_id, name, variant_label, unit_price, quantity)
  SELECT v_order_id,
         NULLIF(item->>'menu_item_id','')::uuid,
         item->>'name',
         item->>'variant_label',
         (item->>'unit_price')::numeric,
         (item->>'quantity')::int
  FROM jsonb_array_elements(_items) AS item;

  SELECT COALESCE(SUM(unit_price * quantity), 0) INTO v_new_total
  FROM public.order_items
  WHERE order_id = v_order_id;

  UPDATE public.orders
     SET total = v_new_total,
         last_appended_at = now(),
         updated_at = now(),
         idempotency_key = _idempotency_key,
         customer_name = v_name
   WHERE id = v_order_id;

  RETURN v_order_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.waiter_place_order(
  _table_number integer,
  _customer_name text,
  _notes text,
  _items jsonb,
  _idempotency_key text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_total numeric;
  v_session_id uuid;
  v_waiter text;
  v_name text := NULLIF(regexp_replace(btrim(coalesce(_customer_name, '')), '\s+', ' ', 'g'), '');
  v_name_key text;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT id INTO v_order_id
  FROM public.orders
  WHERE idempotency_key = _idempotency_key
  LIMIT 1;

  IF v_order_id IS NOT NULL THEN
    RETURN v_order_id;
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'name_required';
  END IF;

  v_name_key := lower(v_name);
  v_waiter := lower(regexp_replace(btrim(coalesce(substring(_notes from '\[Waiter:\s*([^\]]+)\]'), '')), '\s+', ' ', 'g'));

  SELECT id INTO v_session_id
  FROM public.table_sessions
  WHERE table_number = _table_number AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_session_id IS NULL THEN
    INSERT INTO public.table_sessions(table_number)
    VALUES (_table_number)
    RETURNING id INTO v_session_id;
  END IF;

  -- Serialize by table session + customer name + waiter name.
  PERFORM pg_advisory_xact_lock(hashtextextended('waiter-order:' || v_session_id::text || ':' || v_name_key || ':' || v_waiter, 0));

  SELECT id INTO v_order_id
  FROM public.orders
  WHERE session_id = v_session_id
    AND is_paid = false
    AND otp_verified = true
    AND status IN ('pending','preparing','ready')
    AND lower(regexp_replace(btrim(coalesce(customer_name, '')), '\s+', ' ', 'g')) = v_name_key
    AND lower(regexp_replace(btrim(coalesce(substring(notes from '\[Waiter:\s*([^\]]+)\]'), '')), '\s+', ' ', 'g')) = v_waiter
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_order_id IS NULL THEN
    INSERT INTO public.orders(table_number, session_id, customer_name, notes, total, idempotency_key, otp_verified)
    VALUES (_table_number, v_session_id, v_name, _notes, 0, _idempotency_key, true)
    RETURNING id INTO v_order_id;
  END IF;

  INSERT INTO public.order_items(order_id, menu_item_id, name, variant_label, unit_price, quantity)
  SELECT v_order_id,
         NULLIF(item->>'menu_item_id','')::uuid,
         item->>'name',
         item->>'variant_label',
         (item->>'unit_price')::numeric,
         (item->>'quantity')::int
  FROM jsonb_array_elements(_items) AS item;

  SELECT COALESCE(SUM(unit_price * quantity), 0) INTO v_total
  FROM public.order_items
  WHERE order_id = v_order_id;

  UPDATE public.orders
     SET total = v_total,
         last_appended_at = now(),
         updated_at = now(),
         idempotency_key = _idempotency_key,
         customer_name = v_name
   WHERE id = v_order_id;

  RETURN v_order_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.append_order_items(integer, uuid, text, text, numeric, jsonb, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.waiter_place_order(integer, text, text, jsonb, text) TO authenticated;