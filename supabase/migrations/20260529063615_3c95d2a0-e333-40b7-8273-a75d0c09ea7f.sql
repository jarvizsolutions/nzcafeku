-- Reset operational data (orders, items, sessions, waiter calls, feedback, reports)
-- Keeps menu items, categories, combos, tables, user roles, app settings, announcements.
-- Pro admin only.

CREATE OR REPLACE FUNCTION public.reset_app_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'pro_admin'::app_role) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  DELETE FROM public.order_items;
  DELETE FROM public.feedback;
  DELETE FROM public.waiter_calls;
  DELETE FROM public.orders;
  DELETE FROM public.table_sessions;
  DELETE FROM public.monthly_reports;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_app_data() TO authenticated;

NOTIFY pgrst, 'reload schema';