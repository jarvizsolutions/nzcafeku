
CREATE TABLE IF NOT EXISTS public.monthly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  label text NOT NULL,
  total_revenue numeric NOT NULL DEFAULT 0,
  total_orders integer NOT NULL DEFAULT 0,
  total_items integer NOT NULL DEFAULT 0,
  avg_order_value numeric NOT NULL DEFAULT 0,
  overall jsonb NOT NULL DEFAULT '{}'::jsonb,
  item_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (period_start, period_end)
);

ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read monthly reports"
  ON public.monthly_reports FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pro_admin'));

CREATE POLICY "Staff insert monthly reports"
  ON public.monthly_reports FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pro_admin'));

CREATE POLICY "Staff delete monthly reports"
  ON public.monthly_reports FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pro_admin'));
