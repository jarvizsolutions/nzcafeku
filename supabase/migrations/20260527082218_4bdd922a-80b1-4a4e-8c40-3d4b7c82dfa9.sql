
-- 1) Per-item prepared progress counter
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS prepared_quantity int NOT NULL DEFAULT 0;

-- Backfill: items already fully prepared should reflect that in the new counter.
UPDATE public.order_items
   SET prepared_quantity = quantity
 WHERE is_prepared = true AND prepared_quantity = 0;

-- 2) Tick / un-tick one unit (or any delta) of an item's prepared quantity.
--    Never auto-moves an order to 'served'; only nudges pending -> preparing.
CREATE OR REPLACE FUNCTION public.tick_item_prepared(_item_id uuid, _delta int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_id uuid;
  v_qty int;
  v_cur int;
  v_new int;
  v_fully boolean;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT order_id, quantity, prepared_quantity
    INTO v_order_id, v_qty, v_cur
    FROM public.order_items
   WHERE id = _item_id
   FOR UPDATE;

  IF v_order_id IS NULL THEN RETURN; END IF;

  v_new := GREATEST(0, LEAST(v_qty, COALESCE(v_cur, 0) + COALESCE(_delta, 0)));
  v_fully := (v_new >= v_qty);

  UPDATE public.order_items
     SET prepared_quantity = v_new,
         is_prepared = v_fully,
         prepared_at = CASE WHEN v_fully THEN now() ELSE NULL END
   WHERE id = _item_id;

  -- Nudge pending -> preparing as soon as kitchen starts ticking,
  -- but never auto-move to 'served'.
  IF v_new > 0 THEN
    UPDATE public.orders
       SET status = 'preparing', updated_at = now()
     WHERE id = v_order_id AND status = 'pending';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tick_item_prepared(uuid, int) TO authenticated;

-- 3) Keep legacy set_item_prepared working, but no auto-serve anymore.
CREATE OR REPLACE FUNCTION public.set_item_prepared(_item_id uuid, _prepared boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_id uuid;
  v_qty int;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT order_id, quantity INTO v_order_id, v_qty
    FROM public.order_items WHERE id = _item_id FOR UPDATE;

  IF v_order_id IS NULL THEN RETURN; END IF;

  UPDATE public.order_items
     SET is_prepared = _prepared,
         prepared_quantity = CASE WHEN _prepared THEN v_qty ELSE 0 END,
         prepared_at = CASE WHEN _prepared THEN now() ELSE NULL END
   WHERE id = _item_id;

  IF _prepared THEN
    UPDATE public.orders SET status = 'preparing', updated_at = now()
     WHERE id = v_order_id AND status = 'pending';
  END IF;
END;
$$;
