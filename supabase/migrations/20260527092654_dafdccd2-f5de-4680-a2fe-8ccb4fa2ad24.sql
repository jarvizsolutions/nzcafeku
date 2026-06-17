
-- Per-item cancellation by kitchen
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS is_cancelled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- Cancel a single order item; recompute order total excluding cancelled items.
CREATE OR REPLACE FUNCTION public.cancel_order_item(_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_id uuid;
  v_total numeric;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT order_id INTO v_order_id
    FROM public.order_items WHERE id = _item_id FOR UPDATE;
  IF v_order_id IS NULL THEN RETURN; END IF;

  UPDATE public.order_items
     SET is_cancelled = true,
         cancelled_at = now(),
         is_prepared = false,
         prepared_quantity = 0
   WHERE id = _item_id;

  SELECT COALESCE(SUM(unit_price * quantity), 0) INTO v_total
    FROM public.order_items
   WHERE order_id = v_order_id AND is_cancelled = false;

  UPDATE public.orders
     SET total = v_total, updated_at = now()
   WHERE id = v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_order_item(uuid) TO authenticated;

-- Make sure realtime UPDATE payloads include all columns for both tables
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Force PostgREST to reload schema cache (fixes "function not found" errors)
NOTIFY pgrst, 'reload schema';
