-- Values the business changes, out of the build and into a row.
--
-- The booking link, the contact details and the address the app sends mail
-- from were all VITE_ or process env. Vite inlines VITE_ ones at build time, so
-- changing the Calendly link meant editing an environment variable and waiting
-- for a redeploy, which is not a thing to ask of the person whose calendar it
-- is. These are not secrets and never should be: keys stay in the environment,
-- where the browser cannot read them.
--
-- Key and value rather than a column each, because the set will grow and a
-- migration per setting is how a settings page stops being worth having.

CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Supabase grants anon and authenticated ALL on new tables through ALTER
-- DEFAULT PRIVILEGES. Only reading should be open here.
REVOKE ALL ON public.site_settings FROM anon, authenticated;
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.site_settings TO authenticated;

-- Readable by everyone, including signed out: the landing page needs the
-- booking link and the footer needs the address. Nothing secret goes in here,
-- and the grant above is the reminder of that.
DROP POLICY IF EXISTS "Anyone can read settings" ON public.site_settings;
CREATE POLICY "Anyone can read settings" ON public.site_settings
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins write settings" ON public.site_settings;
CREATE POLICY "Admins write settings" ON public.site_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins update settings" ON public.site_settings;
CREATE POLICY "Admins update settings" ON public.site_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Seeded empty rather than absent, so the settings page lists what can be set
-- instead of an admin having to know the key names.
INSERT INTO public.site_settings (key, value) VALUES
  ('booking_url', ''),
  ('contact_email', ''),
  ('contact_phone', ''),
  ('contact_address', ''),
  ('contact_form_email', ''),
  ('email_from', ''),
  ('social_instagram', ''),
  ('social_x', ''),
  ('social_linkedin', '')
ON CONFLICT (key) DO NOTHING;
