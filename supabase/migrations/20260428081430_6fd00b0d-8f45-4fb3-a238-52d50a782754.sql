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