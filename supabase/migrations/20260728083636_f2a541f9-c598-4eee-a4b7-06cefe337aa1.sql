CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Bootstrap: the first signed-in user may claim admin while no admin exists.
CREATE OR REPLACE FUNCTION public.claim_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN RETURN false; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin') ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_admin() TO authenticated;

CREATE TABLE public.game_settings (
  id integer PRIMARY KEY DEFAULT 1,
  starting_fluency integer NOT NULL DEFAULT 50,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_settings_single_row CHECK (id = 1),
  CONSTRAINT game_settings_fluency_range CHECK (starting_fluency BETWEEN 1 AND 100)
);
GRANT SELECT ON public.game_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.game_settings TO authenticated;
GRANT ALL ON public.game_settings TO service_role;
ALTER TABLE public.game_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads settings" ON public.game_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write settings" ON public.game_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.game_settings (id, starting_fluency) VALUES (1, 50);

CREATE TABLE public.custom_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  npc text NOT NULL DEFAULT '',
  blurb text NOT NULL DEFAULT '',
  time_limit integer NOT NULL DEFAULT 0,
  intro text NOT NULL DEFAULT '',
  outro text NOT NULL DEFAULT '',
  challenges jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 100,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.custom_zones TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_zones TO authenticated;
GRANT ALL ON public.custom_zones TO service_role;
ALTER TABLE public.custom_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads published zones" ON public.custom_zones FOR SELECT TO anon, authenticated
  USING (published OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage zones" ON public.custom_zones FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER custom_zones_touch BEFORE UPDATE ON public.custom_zones
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER game_settings_touch BEFORE UPDATE ON public.game_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();