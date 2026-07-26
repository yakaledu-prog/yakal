-- Yakal college catalog schema (Postgres / Supabase)
--
-- Three layers, deliberately separate:
--   colleges              machine-derived, wholesale-replaced once a year
--   college_cycles        hand-curated per admissions cycle, never auto-touched
--   student_college_list  the student's and counselor's own judgement
--
-- Primary key everywhere is `unitid`, the IPEDS unit ID. It is the only stable
-- national identifier for a US institution. Do not invent a surrogate key.

-- ---------------------------------------------------------------------------
-- Layer 1: machine-derived. Source: College Scorecard + Wikidata.
-- Refreshed annually. Safe to truncate and reload.
-- ---------------------------------------------------------------------------
create table if not exists colleges (
  unitid                      integer primary key,
  opeid6                      text,
  name                        text not null,
  city                        text,
  state                       char(2),
  zip                         text,
  lat                         double precision,
  lon                         double precision,
  website                     text,
  net_price_calculator_url    text,

  control                     text check (control in
                                ('public','private_nonprofit','private_for_profit')),
  locale                      text check (locale in ('city','suburb','town','rural')),
  carnegie_basic              smallint,
  hbcu                        boolean not null default false,
  men_only                    boolean not null default false,
  women_only                  boolean not null default false,
  religious_affiliation_code  smallint,

  admit_rate_pct              numeric(4,1),
  -- 'required' | 'considered_not_required' | 'not_considered'
  -- Scorecard lags reality by more than a year on this. Treat as a hint, and let
  -- the curated layer override it.
  test_policy                 text,
  sat_total_25                smallint,
  sat_total_75                smallint,
  sat_ebrw_25                 smallint,
  sat_ebrw_75                 smallint,
  sat_math_25                 smallint,
  sat_math_75                 smallint,
  sat_avg                     smallint,
  act_composite_25            smallint,
  act_composite_75            smallint,

  undergrads                  integer,
  student_faculty_ratio       numeric(4,1),
  retention_rate_pct          numeric(4,1),
  grad_rate_6yr_pct           numeric(4,1),
  median_earnings_10yr        integer,

  cost_of_attendance          integer,
  tuition_in_state            integer,
  tuition_out_of_state        integer,
  avg_net_price               integer,
  avg_net_price_income_0_30k  integer,
  pct_pell                    numeric(4,1),

  image_url                   text,
  logo_url                    text,
  wikidata_label              text,

  source_release              text,        -- e.g. 'scorecard-2026-06-10'
  refreshed_at                timestamptz not null default now()
);

create index if not exists colleges_state_idx        on colleges (state);
create index if not exists colleges_control_idx      on colleges (control);
create index if not exists colleges_admit_rate_idx   on colleges (admit_rate_pct);
create index if not exists colleges_net_price_idx    on colleges (avg_net_price);
create index if not exists colleges_undergrads_idx   on colleges (undergrads desc);

-- Trigram search on name, so "hopkins" and "john hopkins" both find Johns Hopkins.
create extension if not exists pg_trgm;
create index if not exists colleges_name_trgm_idx on colleges using gin (name gin_trgm_ops);


-- ---------------------------------------------------------------------------
-- Layer 2: hand-curated, per admissions cycle.
-- Loaded from data/colleges/curated/cycle_<year>.csv. NEVER written by the build.
-- ---------------------------------------------------------------------------
create table if not exists college_cycles (
  unitid                    integer not null references colleges(unitid) on delete cascade,
  cycle                     smallint not null,   -- 2027 = fall 2027 entry

  common_app                boolean,
  coalition_app             boolean,
  own_application           boolean,
  application_fee           integer,
  fee_waiver_available      boolean,

  deadline_ed1              date,
  deadline_ed2              date,
  deadline_ea               date,
  deadline_rea              date,
  deadline_rd               date,
  deadline_rolling          boolean,
  deadline_priority         date,
  notify_ed1                date,
  notify_rd                 date,

  supplemental_essay_count  smallint,
  -- [{"prompt": "...", "word_limit": 300, "required": true}]
  supplemental_essays       jsonb,

  recs_teacher_required     smallint,
  recs_counselor_required   smallint,
  recs_max_optional         smallint,
  interview                 text check (interview in
                              ('required','optional','evaluative','none')),
  portfolio_required        boolean,

  -- Common Data Set section C. Not available from any API.
  admitted_gpa_avg          numeric(4,2),
  admitted_gpa_scale        text,
  cds_url                   text,

  -- Provenance. Every curated row must say who checked it and when, so the UI can
  -- mark anything older than 12 months as unverified.
  source_url                text,
  verified_by               text,
  verified_on               date,
  notes                     text,

  primary key (unitid, cycle)
);

create index if not exists college_cycles_cycle_idx on college_cycles (cycle);
create index if not exists college_cycles_rd_idx    on college_cycles (cycle, deadline_rd);

-- Guard rails. A wrong deadline is worse than a blank one, so reject the obviously
-- impossible at write time rather than discovering it in a student's dashboard.
alter table college_cycles drop constraint if exists cycle_deadlines_sane;
alter table college_cycles add constraint cycle_deadlines_sane check (
  (deadline_ed1 is null or deadline_ed1 between
     make_date(cycle - 2, 8, 1) and make_date(cycle - 1, 3, 1)) and
  (deadline_rd  is null or deadline_rd  between
     make_date(cycle - 2, 9, 1) and make_date(cycle - 1, 8, 1)) and
  (application_fee is null or application_fee between 0 and 500) and
  (supplemental_essay_count is null or supplemental_essay_count between 0 and 20)
);


-- ---------------------------------------------------------------------------
-- Image licensing. Most Commons photos are CC BY or CC BY-SA and legally require
-- visible photographer credit. This table is what renders that credit.
-- ---------------------------------------------------------------------------
create table if not exists college_images (
  unitid                integer not null references colleges(unitid) on delete cascade,
  file                  text not null,
  license               text,
  license_url           text,
  artist                text,
  credit                text,
  attribution_required  boolean not null default true,
  commercial_use_ok     boolean not null default false,
  descriptionurl        text,
  cdn_url               text,           -- our own copy, do not hotlink Commons
  width                 integer,
  height                integer,
  is_primary            boolean not null default false,
  primary key (unitid, file)
);

-- Only ship images we are allowed to ship.
create index if not exists college_images_usable_idx
  on college_images (unitid) where commercial_use_ok;


-- ---------------------------------------------------------------------------
-- Layer 3: the student's own list. References the catalog, never copies it.
-- This is what prevents the duplicate-school-with-conflicting-data problem.
-- ---------------------------------------------------------------------------
create table if not exists student_college_list (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null,
  unitid          integer references colleges(unitid),

  -- Escape hatch for foreign and very small institutions not in IPEDS.
  -- Exactly one of unitid or custom_name must be set.
  custom_name     text,

  -- The student proposes, the counselor decides. Two separate columns on purpose:
  -- the disagreement between them is the counseling product.
  student_category   text check (student_category in ('reach','target','safety')),
  counselor_category text check (counselor_category in ('reach','target','safety')),
  counselor_rationale text,
  reviewed_by     uuid,
  reviewed_at     timestamptz,

  status          text not null default 'proposed' check (status in
                    ('proposed','in_review','active','applied','decided')),
  decision        text check (decision in
                    ('accepted','waitlisted','denied','enrolled')),

  -- The student's own words. Never prefilled.
  intended_program text,
  why_this_school  text,

  applied_round   text check (applied_round in ('ed1','ed2','ea','rea','rd','rolling')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint one_school_ref check (
    (unitid is not null and custom_name is null) or
    (unitid is null and custom_name is not null)
  ),
  unique (student_id, unitid)
);

create index if not exists scl_student_idx on student_college_list (student_id);


-- ---------------------------------------------------------------------------
-- Read view: what the UI actually queries. Joins the catalog to the current
-- cycle and exposes whether the deadline data has been verified.
-- ---------------------------------------------------------------------------
create or replace view college_catalog as
select
  c.*,
  cy.cycle,
  cy.common_app,
  cy.application_fee,
  cy.deadline_ed1,
  cy.deadline_ea,
  cy.deadline_rd,
  cy.deadline_rolling,
  cy.supplemental_essay_count,
  cy.supplemental_essays,
  cy.recs_teacher_required,
  cy.admitted_gpa_avg,
  cy.verified_on,
  -- Drives the "unverified" marker in the UI. Blank beats wrong, but stale also
  -- beats silent.
  (cy.verified_on is not null and cy.verified_on > current_date - interval '12 months')
    as deadlines_verified
from colleges c
left join college_cycles cy
  on cy.unitid = c.unitid
 and cy.cycle = extract(year from current_date)::smallint
     + case when extract(month from current_date) >= 8 then 2 else 1 end;
