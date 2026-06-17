-- Allow public (anonymous) writes to app_settings and categories for the hidden /nzzht panel
DROP POLICY IF EXISTS "Admins or pro update settings" ON public.app_settings;
CREATE POLICY "Anyone updates settings" ON public.app_settings FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins or pro manage categories" ON public.categories;
CREATE POLICY "Anyone manages categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);