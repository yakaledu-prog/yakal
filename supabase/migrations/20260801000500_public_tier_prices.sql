-- A price list on a marketing page has to be readable by somebody who has not
-- signed up yet, which is the entire point of putting it there. Active tiers
-- only, and they contain nothing but the offer.
DROP POLICY IF EXISTS admissions_tiers_read ON public.admissions_tiers;
CREATE POLICY admissions_tiers_read ON public.admissions_tiers
  FOR SELECT TO anon, authenticated USING (is_active OR public.is_admin());
