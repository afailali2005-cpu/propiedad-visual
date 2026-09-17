-- Perfiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  videos_usados_mes INTEGER NOT NULL DEFAULT 0,
  tours_usados_mes INTEGER NOT NULL DEFAULT 0,
  periodo_inicio TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),
  stripe_customer_id TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_plan_check CHECK (plan IN ('free','starter','pro','agency'))
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Proyectos
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'subiendo',
  archivos_entrada JSONB NOT NULL DEFAULT '[]'::jsonb,
  url_resultado TEXT,
  miniatura_url TEXT,
  error_mensaje TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT projects_tipo_check CHECK (tipo IN ('video','tour3d')),
  CONSTRAINT projects_estado_check CHECK (estado IN ('subiendo','procesando','listo','error'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_select_own" ON public.projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "projects_insert_own" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "projects_update_own" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "projects_delete_own" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX projects_user_idx ON public.projects(user_id, creado_en DESC);

-- Lista de espera
CREATE TABLE public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.waitlist TO anon, authenticated;
GRANT ALL ON public.waitlist TO service_role;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "waitlist_insert_public" ON public.waitlist FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Timestamps
CREATE OR REPLACE FUNCTION public.set_actualizado_en()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.actualizado_en = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_set_actualizado BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_actualizado_en();
CREATE TRIGGER projects_set_actualizado BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_actualizado_en();

-- Crear perfil automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();