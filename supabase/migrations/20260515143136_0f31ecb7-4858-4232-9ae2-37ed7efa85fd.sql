
-- 1) categories.is_hidden
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

-- 2) menu_items.is_special
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS is_special boolean NOT NULL DEFAULT false;

-- 3) app_settings flags
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS show_specials boolean NOT NULL DEFAULT true;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS show_combos   boolean NOT NULL DEFAULT true;

-- 4) combos
CREATE TABLE IF NOT EXISTS public.combos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  image_url text,
  original_price numeric NOT NULL DEFAULT 0,
  offer_price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_special boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads active combos" ON public.combos;
CREATE POLICY "Anyone reads active combos" ON public.combos FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admins manage combos" ON public.combos;
CREATE POLICY "Admins manage combos" ON public.combos FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS combos_set_updated_at ON public.combos;
CREATE TRIGGER combos_set_updated_at BEFORE UPDATE ON public.combos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) combo_items
CREATE TABLE IF NOT EXISTS public.combo_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  combo_id uuid NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_combo_items_combo ON public.combo_items(combo_id);
ALTER TABLE public.combo_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads combo items" ON public.combo_items;
CREATE POLICY "Anyone reads combo items" ON public.combo_items FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admins manage combo items" ON public.combo_items;
CREATE POLICY "Admins manage combo items" ON public.combo_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 6) announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  message text NOT NULL,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads announcements" ON public.announcements;
CREATE POLICY "Anyone reads announcements" ON public.announcements FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admins manage announcements" ON public.announcements;
CREATE POLICY "Admins manage announcements" ON public.announcements FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS announcements_set_updated_at ON public.announcements;
CREATE TRIGGER announcements_set_updated_at BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.combos;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.combo_items;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 8) Storage policies for menu-images bucket (uploads from admin)
DROP POLICY IF EXISTS "menu-images public read" ON storage.objects;
CREATE POLICY "menu-images public read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'menu-images');

DROP POLICY IF EXISTS "menu-images authenticated insert" ON storage.objects;
CREATE POLICY "menu-images authenticated insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'menu-images');

DROP POLICY IF EXISTS "menu-images authenticated update" ON storage.objects;
CREATE POLICY "menu-images authenticated update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'menu-images') WITH CHECK (bucket_id = 'menu-images');

DROP POLICY IF EXISTS "menu-images authenticated delete" ON storage.objects;
CREATE POLICY "menu-images authenticated delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'menu-images');
