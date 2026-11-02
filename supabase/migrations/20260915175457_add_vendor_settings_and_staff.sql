ALTER TABLE public.vendors
  ADD COLUMN accepting_orders boolean NOT NULL DEFAULT true;

CREATE TABLE public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL,
  email text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'break', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
