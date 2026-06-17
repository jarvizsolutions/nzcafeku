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