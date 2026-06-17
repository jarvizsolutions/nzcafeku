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