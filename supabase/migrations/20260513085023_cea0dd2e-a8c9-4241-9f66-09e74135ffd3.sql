
-- 1) Make sure the realtime publication carries the tables the apps subscribe to.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['orders','order_items','table_sessions','waiter_calls','categories','menu_items','feedback']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

ALTER TABLE public.menu_items REPLICA IDENTITY FULL;
ALTER TABLE public.categories REPLICA IDENTITY FULL;
ALTER TABLE public.feedback REPLICA IDENTITY FULL;

-- 2) Customer-facing append: only merge with an existing open order when the
-- customer name matches (case-insensitive). Different names => separate orders.
CREATE OR REPLACE FUNCTION public.append_order_items(
  _table_number integer, _session_id uuid, _customer_name text, _notes text,
  _added_total numeric, _items jsonb, _idempotency_key text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_new_total numeric;
  v_require_otp boolean;
  v_otp text;
  v_name text := NULLIF(btrim(_customer_name),'');
BEGIN
  SELECT id INTO v_order_id FROM public.orders WHERE idempotency_key = _idempotency_key LIMIT 1;
  IF v_order_id IS NOT NULL THEN RETURN v_order_id; END IF;

  IF v_name IS NULL THEN RAISE EXCEPTION 'name_required'; END IF;

  SELECT require_order_otp INTO v_require_otp FROM public.app_settings WHERE id = true;
  v_require_otp := COALESCE(v_require_otp, false);

  -- Reuse only if same session AND same customer name.
  IF _session_id IS NOT NULL THEN
    SELECT id INTO v_order_id
    FROM public.orders
    WHERE session_id = _session_id
      AND is_paid = false
      AND status IN ('pending','preparing','ready')
      AND lower(btrim(coalesce(customer_name,''))) = lower(v_name)
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  END IF;

  IF v_order_id IS NULL THEN
    IF v_require_otp THEN
      v_otp := lpad(floor(random() * 10000)::int::text, 4, '0');
    END IF;
    INSERT INTO public.orders (
      table_number, session_id, customer_name, notes, total, idempotency_key,
      staff_otp, otp_verified, otp_issued_at
    ) VALUES (
      _table_number, _session_id, v_name, _notes, _added_total, _idempotency_key,
      v_otp, NOT v_require_otp, CASE WHEN v_require_otp THEN now() ELSE NULL END
    ) RETURNING id INTO v_order_id;
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
    FROM public.order_items WHERE order_id = v_order_id;

  UPDATE public.orders
     SET total = v_new_total, last_appended_at = now(),
         updated_at = now(), idempotency_key = _idempotency_key
   WHERE id = v_order_id;

  RETURN v_order_id;
END $function$;

-- 3) Waiter-facing place: only merge if same waiter (notes prefix) AND same customer name.
CREATE OR REPLACE FUNCTION public.waiter_place_order(
  _table_number integer, _customer_name text, _notes text,
  _items jsonb, _idempotency_key text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_total numeric;
  v_session_id uuid;
  v_waiter text;
  v_name text := NULLIF(btrim(_customer_name),'');
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  SELECT id INTO v_order_id FROM public.orders WHERE idempotency_key=_idempotency_key LIMIT 1;
  IF v_order_id IS NOT NULL THEN RETURN v_order_id; END IF;

  -- Extract waiter name from "[Waiter: X] ..." prefix in notes
  v_waiter := lower(btrim(coalesce(substring(_notes from '\[Waiter:\s*([^\]]+)\]'),'')));

  SELECT id INTO v_session_id FROM public.table_sessions
    WHERE table_number=_table_number AND status='active'
    ORDER BY created_at DESC LIMIT 1;
  IF v_session_id IS NULL THEN
    INSERT INTO public.table_sessions(table_number) VALUES (_table_number) RETURNING id INTO v_session_id;
  END IF;

  -- Reuse only if same session AND same waiter AND same customer name
  SELECT id INTO v_order_id FROM public.orders
   WHERE session_id=v_session_id AND is_paid=false AND otp_verified=true
     AND status IN ('pending','preparing','ready')
     AND lower(btrim(coalesce(substring(notes from '\[Waiter:\s*([^\]]+)\]'),''))) = v_waiter
     AND lower(btrim(coalesce(customer_name,''))) = lower(coalesce(v_name,''))
   ORDER BY created_at DESC LIMIT 1 FOR UPDATE;

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

  SELECT COALESCE(SUM(unit_price*quantity),0) INTO v_total
    FROM public.order_items WHERE order_id=v_order_id;

  UPDATE public.orders SET total=v_total, last_appended_at=now(), updated_at=now(), idempotency_key=_idempotency_key
   WHERE id=v_order_id;

  RETURN v_order_id;
END $function$;
