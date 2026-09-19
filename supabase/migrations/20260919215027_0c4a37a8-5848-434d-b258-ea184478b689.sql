ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS planos_usados_mes integer NOT NULL DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS plano_colorizado_url text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS plano_3d_url text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS anotaciones jsonb;
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_tipo_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_tipo_check CHECK (tipo IN ('video','tour3d','plano2d'));