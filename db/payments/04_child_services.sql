-- ============================================================
-- YAKAL - Per-child service enrollment (Tutoring / Admissions)
-- Run any time (idempotent). Powers the parent "Manage Services"
-- selector: assign different services to different children.
-- (Display/preference now; not wired to charges this phase.)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.child_services (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service     text NOT NULL CHECK (service IN ('tutoring', 'admissions')),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, service)
);
CREATE INDEX IF NOT EXISTS child_services_student_idx ON public.child_services(student_id);

DROP TRIGGER IF EXISTS child_services_updated_at ON public.child_services;
CREATE TRIGGER child_services_updated_at BEFORE UPDATE ON public.child_services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.child_services ENABLE ROW LEVEL SECURITY;

-- Parent of the child (active link) manages the child's services
DROP POLICY IF EXISTS child_services_parent_all ON public.child_services;
CREATE POLICY child_services_parent_all ON public.child_services FOR ALL
  USING (EXISTS (SELECT 1 FROM public.parent_student_links psl
                 WHERE psl.parent_id = auth.uid() AND psl.status = 'active'
                   AND psl.student_id = child_services.student_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.parent_student_links psl
                      WHERE psl.parent_id = auth.uid() AND psl.status = 'active'
                        AND psl.student_id = child_services.student_id));

-- Student can read their own services
DROP POLICY IF EXISTS child_services_student_select ON public.child_services;
CREATE POLICY child_services_student_select ON public.child_services FOR SELECT
  USING (auth.uid() = student_id);

-- Admin sees all
DROP POLICY IF EXISTS child_services_admin_all ON public.child_services;
CREATE POLICY child_services_admin_all ON public.child_services FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed defaults for the demo student so the selector isn't empty.
DO $$
DECLARE v_student uuid;
BEGIN
  SELECT id INTO v_student FROM public.profiles WHERE email = 'student@yakal.com';
  IF v_student IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.child_services WHERE student_id = v_student) THEN
    INSERT INTO public.child_services (student_id, service, is_active) VALUES
      (v_student, 'tutoring', true),
      (v_student, 'admissions', false);
  END IF;
END $$;

SELECT 'child_services ready.' AS status;
