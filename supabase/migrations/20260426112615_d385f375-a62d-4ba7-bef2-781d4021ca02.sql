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