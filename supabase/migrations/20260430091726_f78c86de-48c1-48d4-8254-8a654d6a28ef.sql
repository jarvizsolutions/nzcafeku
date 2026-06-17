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