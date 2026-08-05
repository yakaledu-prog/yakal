-- Role becomes one of the roles the app actually has.
--
-- It started as free text, so the three seeded rows carried "Algebra Student",
-- "Physics & Calculus Student" and "SAT Prep Student": three spellings of one
-- fact. Specific labels read well on a card, but they cannot be filtered,
-- counted or coloured, and a list of one-of-each filter pills is not a filter.
--
-- So role now matches profiles.role, capitalised, and the admin form offers a
-- dropdown. Existing rows are mapped onto that set or they would open with
-- nothing selected.
--
-- No CHECK constraint. The set will grow the day the app grows a role, and a
-- constraint would make that a migration on top of a migration. The dropdown
-- is the control that matters.

UPDATE public.testimonials
SET role = CASE
  WHEN role ILIKE '%parent%'    THEN 'Parent'
  WHEN role ILIKE '%counselor%' THEN 'Counselor'
  WHEN role ILIKE '%tutor%'     THEN 'Tutor'
  WHEN role ILIKE '%student%'   THEN 'Student'
  ELSE 'Student'
END
WHERE role NOT IN ('Student', 'Parent', 'Tutor', 'Counselor');
