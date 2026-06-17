-- 1) Add customer phone column to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone text;

-- 2) Recreate append_order_items with _customer_phone param
DROP FUNCTION IF EXISTS public.append_order_items(integer, uuid, text, text, numeric, jsonb, text);

CREATE OR REPLACE FUNCTION public.append_order_items(
  _table_number integer,
  _session_id uuid,
  _customer_name text,
  _customer_phone text,
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
  v_session_id uuid := _session_id;
  v_name text := NULLIF(regexp_replace(btrim(coalesce(_customer_name, '')), '\s+', ' ', 'g'), '');
  v_phone text := NULLIF(regexp_replace(btrim(coalesce(_customer_phone, '')), '\s+', '', 'g'), '');
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

  PERFORM pg_advisory_xact_lock(hashtextextended('customer-order:' || coalesce(v_session_id::text, 'table-' || _table_number::text) || ':' || v_name_key, 0));

  SELECT require_order_otp INTO v_require_otp FROM public.app_settings WHERE id = true;
  v_require_otp := COALESCE(v_require_otp, false);

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
      table_number, session_id, customer_name, customer_phone, notes, total, idempotency_key,
      staff_otp, otp_verified, otp_issued_at
    ) VALUES (
      _table_number, v_session_id, v_name, v_phone, _notes, _added_total, _idempotency_key,
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
         customer_name = v_name,
         customer_phone = COALESCE(v_phone, customer_phone)
   WHERE id = v_order_id;

  RETURN v_order_id;
END;
$function$;

-- 3) Recreate waiter_place_order with _customer_phone param
DROP FUNCTION IF EXISTS public.waiter_place_order(integer, text, text, jsonb, text);

CREATE OR REPLACE FUNCTION public.waiter_place_order(
  _table_number integer,
  _customer_name text,
  _customer_phone text,
  _notes text,
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
  v_total numeric;
  v_session_id uuid;
  v_waiter text;
  v_name text := NULLIF(regexp_replace(btrim(coalesce(_customer_name, '')), '\s+', ' ', 'g'), '');
  v_phone text := NULLIF(regexp_replace(btrim(coalesce(_customer_phone, '')), '\s+', '', 'g'), '');
  v_name_key text;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT id INTO v_order_id FROM public.orders WHERE idempotency_key = _idempotency_key LIMIT 1;
  IF v_order_id IS NOT NULL THEN RETURN v_order_id; END IF;

  IF v_name IS NULL THEN RAISE EXCEPTION 'name_required'; END IF;

  v_name_key := lower(v_name);
  v_waiter := lower(regexp_replace(btrim(coalesce(substring(_notes from '\[Waiter:\s*([^\]]+)\]'), '')), '\s+', ' ', 'g'));

  SELECT id INTO v_session_id
  FROM public.table_sessions
  WHERE table_number = _table_number AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_session_id IS NULL THEN
    INSERT INTO public.table_sessions(table_number) VALUES (_table_number) RETURNING id INTO v_session_id;
  END IF;

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
    INSERT INTO public.orders(table_number, session_id, customer_name, customer_phone, notes, total, idempotency_key, otp_verified)
    VALUES (_table_number, v_session_id, v_name, v_phone, _notes, 0, _idempotency_key, true)
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

  SELECT COALESCE(SUM(unit_price * quantity), 0) INTO v_total FROM public.order_items WHERE order_id = v_order_id;

  UPDATE public.orders
     SET total = v_total,
         last_appended_at = now(),
         updated_at = now(),
         idempotency_key = _idempotency_key,
         customer_name = v_name,
         customer_phone = COALESCE(v_phone, customer_phone)
   WHERE id = v_order_id;

  RETURN v_order_id;
END;
$function$;