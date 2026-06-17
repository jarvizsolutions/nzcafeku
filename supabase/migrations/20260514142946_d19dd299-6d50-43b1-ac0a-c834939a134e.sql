-- Ensure default settings row exists
INSERT INTO public.app_settings (id, require_order_otp, ordering_mode)
VALUES (true, false, 'qr')
ON CONFLICT (id) DO NOTHING;

-- Allow public inserts so upsert from /nzzht and admin works even if row was deleted
DROP POLICY IF EXISTS "Anyone inserts settings" ON public.app_settings;
CREATE POLICY "Anyone inserts settings"
  ON public.app_settings FOR INSERT
  WITH CHECK (true);