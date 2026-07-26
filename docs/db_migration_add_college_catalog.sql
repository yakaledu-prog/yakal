-- College catalog + provenance on the student's college list.
--
-- Two things happen here:
--   1. college_list_items references the federal catalog by IPEDS unitid
--      instead of storing a free-text school name, which is what allowed the
--      same school to exist twice with two different sticker prices.
--   2. Every field a human typed carries who typed it, who verified it, and
--      the URL they read. A deadline nobody checked must never be
--      indistinguishable from one a counselor confirmed.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Link list items to the catalog
-- ---------------------------------------------------------------------------
alter table college_list_items
  add column if not exists unitid integer;

comment on column college_list_items.unitid is
  'IPEDS unit ID. Null for colleges not in the federal data (foreign '
  'universities, very small institutions), which keep only school_name.';

create index if not exists cli_unitid_idx on college_list_items (unitid);

-- A student should not be able to add the same college twice. Only applies to
-- catalog-backed rows; manual entries are not constrained because two students
-- may legitimately spell a foreign university differently.
create unique index if not exists cli_student_unitid_uniq
  on college_list_items (student_id, unitid)
  where unitid is not null;

-- ---------------------------------------------------------------------------
-- 2. The fields no public dataset supplies, entered by a human
-- ---------------------------------------------------------------------------
alter table college_list_items
  add column if not exists deadline_round text,
  add column if not exists application_url text,
  add column if not exists supp_essay_count smallint,
  add column if not exists why_school text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cli_deadline_round_valid'
  ) then
    alter table college_list_items add constraint cli_deadline_round_valid
      check (deadline_round is null or deadline_round in
             ('ed1','ed2','ea','rea','rd','rolling'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'cli_essay_count_sane'
  ) then
    alter table college_list_items add constraint cli_essay_count_sane
      check (supp_essay_count is null or supp_essay_count between 0 and 20);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Provenance
--
-- verified_by holds the counselor's profile id, not a boolean. A wrong
-- deadline is consequential, so we need to answer three questions after the
-- fact: who said this was right, when, and what did they read. A boolean
-- answers none of them.
-- ---------------------------------------------------------------------------
alter table college_list_items
  add column if not exists entered_by uuid,
  add column if not exists verified_by uuid,
  add column if not exists verified_at timestamptz,
  add column if not exists verification_note text;

comment on column college_list_items.verified_by is
  'Counselor profile id who confirmed the deadline and requirements against '
  'the school''s own page. Null means nobody has checked it.';

-- Verification is a set: you cannot have a verifier without a timestamp.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cli_verification_complete'
  ) then
    alter table college_list_items add constraint cli_verification_complete
      check ((verified_by is null) = (verified_at is null));
  end if;
end $$;

create index if not exists cli_unverified_idx
  on college_list_items (student_id)
  where verified_by is null and deadline is not null;

-- ---------------------------------------------------------------------------
-- 4. Catalog contributions
--
-- A verified deadline is worth far more to the next 200 students than to the
-- one who typed it. This is where a counselor-verified fact is proposed for
-- the shared catalog.
--
-- Deliberately NOT the same table as college_cycles. A single counselor
-- verifying one student's row is evidence, not truth. Promotion into the
-- shared catalog is a separate, reviewed step, because a counselor who is
-- wrong once would otherwise be wrong for every future student.
-- ---------------------------------------------------------------------------
create table if not exists college_field_contributions (
  id            uuid primary key default gen_random_uuid(),
  unitid        integer not null,
  cycle         smallint not null,
  field         text not null,          -- 'deadline_ed1', 'supp_essay_count', ...
  value         text not null,
  source_url    text,

  contributed_by uuid not null,         -- whoever typed it
  verified_by    uuid,                  -- counselor who confirmed it
  verified_at    timestamptz,

  -- Set once a reviewer promotes this into college_cycles.
  promoted_at   timestamptz,
  promoted_by   uuid,

  created_at    timestamptz not null default now(),
  unique (unitid, cycle, field, contributed_by)
);

create index if not exists cfc_pending_idx
  on college_field_contributions (unitid, cycle, field)
  where promoted_at is null;

-- Agreement across independent contributors is the cheapest corroboration
-- signal available. Two people who never met typing the same date is strong
-- evidence; one person typing it is not.
create or replace view college_field_consensus as
select
  unitid,
  cycle,
  field,
  value,
  count(*)                              as contributions,
  count(verified_by)                    as counselor_verifications,
  min(source_url)                       as a_source_url,
  max(verified_at)                      as last_verified_at
from college_field_contributions
where promoted_at is null
group by unitid, cycle, field, value;
