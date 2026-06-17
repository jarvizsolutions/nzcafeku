-- 1. Table sessions
CREATE TABLE public.table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX idx_table_sessions_active ON public.table_sessions (table_number) WHERE status = 'active';

ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads sessions" ON public.table_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone creates session" ON public.table_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff updates sessions" ON public.table_sessions FOR UPDATE
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admins delete sessions" ON public.table_sessions FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Orders: session_id + is_rush + idempotency_key
ALTER TABLE public.orders
  ADD COLUMN session_id UUID REFERENCES public.table_sessions(id) ON DELETE SET NULL,
  ADD COLUMN is_rush BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX idx_orders_idempotency ON public.orders (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_orders_session ON public.orders (session_id);

-- 3. Auto-close session when ALL its orders are paid
CREATE OR REPLACE FUNCTION public.maybe_close_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  unpaid_count INTEGER;
BEGIN
  IF NEW.session_id IS NULL OR NEW.is_paid = false THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO unpaid_count
  FROM public.orders
  WHERE session_id = NEW.session_id AND is_paid = false;

  IF unpaid_count = 0 THEN
    UPDATE public.table_sessions
       SET status = 'closed', closed_at = now()
     WHERE id = NEW.session_id AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_maybe_close_session
AFTER UPDATE OF is_paid ON public.orders
FOR EACH ROW
WHEN (NEW.is_paid = true)
EXECUTE FUNCTION public.maybe_close_session();

-- 4. Waiter calls
CREATE TABLE public.waiter_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number INTEGER NOT NULL,
  session_id UUID REFERENCES public.table_sessions(id) ON DELETE SET NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_waiter_calls_pending ON public.waiter_calls (created_at DESC) WHERE status = 'pending';

ALTER TABLE public.waiter_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone creates waiter call" ON public.waiter_calls FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff reads waiter calls" ON public.waiter_calls FOR SELECT
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff updates waiter calls" ON public.waiter_calls FOR UPDATE
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admins delete waiter calls" ON public.waiter_calls FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.waiter_calls;
ALTER TABLE public.table_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.waiter_calls REPLICA IDENTITY FULL;