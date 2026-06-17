-- Flag for items inserted directly from the kitchen (extras like sauce, packing).
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS added_by_kitchen boolean NOT NULL DEFAULT false;

-- Allow staff to update items (kitchen edits, qty changes from admin bill editor).
DROP POLICY IF EXISTS "Staff updates order items" ON public.order_items;
CREATE POLICY "Staff updates order items"
  ON public.order_items
  FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));