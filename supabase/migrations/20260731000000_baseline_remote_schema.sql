


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role text;
  v_status text;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  -- Tutors and counselors require admin approval
  IF v_role IN ('tutor', 'counselor') THEN
    v_status := 'pending';
  ELSE
    v_status := 'active';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, status, avatar_url, is_onboarded)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_role,
    v_status,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
    false
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_counselor"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'counselor'
  );
$$;


ALTER FUNCTION "public"."is_counselor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."application_requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "college_list_item_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "is_complete" boolean DEFAULT false NOT NULL,
    "due_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."application_requirements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."application_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'todo'::"text" NOT NULL,
    "due_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "application_tasks_status_check" CHECK (("status" = ANY (ARRAY['todo'::"text", 'in_progress'::"text", 'done'::"text"])))
);


ALTER TABLE "public"."application_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tutor_id" "uuid" NOT NULL,
    "course_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "due_date" timestamp with time zone,
    "template_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_customers" (
    "profile_id" "uuid" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."billing_customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blog_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "thumbnail_url" "text",
    "read_time_minutes" integer DEFAULT 1,
    "status" "text" DEFAULT 'published'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."blog_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."child_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "service" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "child_services_service_check" CHECK (("service" = ANY (ARRAY['tutoring'::"text", 'admissions'::"text"])))
);


ALTER TABLE "public"."child_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."college_guide_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "counselor_id" "uuid",
    "program_interest" "text",
    "personal_statement" "text",
    "documents" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "counselor_notes" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stage" "text" DEFAULT 'research'::"text" NOT NULL,
    "grad_year" integer,
    "fafsa_submitted" boolean DEFAULT false NOT NULL,
    "fafsa_submitted_at" "date",
    "css_submitted" boolean DEFAULT false NOT NULL,
    "css_submitted_at" "date",
    CONSTRAINT "cga_stage_check" CHECK (("stage" = ANY (ARRAY['research'::"text", 'apply'::"text", 'submitted'::"text", 'decisions'::"text", 'enrolled'::"text"]))),
    CONSTRAINT "college_guide_applications_status_check" CHECK (("status" = ANY (ARRAY['submitted'::"text", 'in_review'::"text", 'action_needed'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."college_guide_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."college_list_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "school_name" "text" NOT NULL,
    "tier" "text" DEFAULT 'target'::"text" NOT NULL,
    "deadline" "date",
    "status" "text" DEFAULT 'considering'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "college_list_items_status_check" CHECK (("status" = ANY (ARRAY['considering'::"text", 'applying'::"text", 'submitted'::"text", 'accepted'::"text", 'rejected'::"text", 'waitlisted'::"text"]))),
    CONSTRAINT "college_list_items_tier_check" CHECK (("tier" = ANY (ARRAY['dream'::"text", 'target'::"text", 'safety'::"text"])))
);


ALTER TABLE "public"."college_list_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "subject" "text",
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'unread'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."contact_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_participants" (
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."conversation_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "description" "text",
    "tutor_id" "uuid",
    "thumbnail_url" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "price_cents" integer,
    "tutor_payout_cents" integer,
    "google_classroom_url" "text",
    CONSTRAINT "courses_subject_check" CHECK (("subject" = ANY (ARRAY['Mathematics'::"text", 'Physics'::"text", 'Chemistry'::"text", 'SAT Prep'::"text", 'College Advising'::"text", 'English'::"text", 'Biology'::"text", 'Other'::"text"])))
);


ALTER TABLE "public"."courses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."essays" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "kind" "text" DEFAULT 'supplement'::"text" NOT NULL,
    "college_list_item_id" "uuid",
    "status" "text" DEFAULT 'todo'::"text" NOT NULL,
    "content" "text",
    "drive_url" "text",
    "due_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rounds_used" smallint DEFAULT 0 NOT NULL,
    "last_feedback_at" timestamp with time zone,
    "word_limit" smallint,
    "prompt" "text",
    CONSTRAINT "essays_kind_check" CHECK (("kind" = ANY (ARRAY['personal_statement'::"text", 'supplement'::"text"]))),
    CONSTRAINT "essays_status_check" CHECK (("status" = ANY (ARRAY['todo'::"text", 'drafting'::"text", 'in_review'::"text", 'done'::"text"])))
);


ALTER TABLE "public"."essays" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_id" "uuid" NOT NULL,
    "student_id" "uuid",
    "description" "text" NOT NULL,
    "amount_cents" integer NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "kind" "text" DEFAULT 'tutoring'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "due_date" "date",
    "paid_at" timestamp with time zone,
    "stripe_checkout_session_id" "text",
    "stripe_payment_intent_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tutor_id" "uuid",
    "payout_cents" integer,
    "payout_status" "text" DEFAULT 'none'::"text" NOT NULL,
    CONSTRAINT "invoices_amount_cents_check" CHECK (("amount_cents" >= 0)),
    CONSTRAINT "invoices_kind_check" CHECK (("kind" = ANY (ARRAY['tutoring'::"text", 'admissions'::"text", 'registration'::"text", 'other'::"text"]))),
    CONSTRAINT "invoices_payout_status_check" CHECK (("payout_status" = ANY (ARRAY['none'::"text", 'pending'::"text", 'paid'::"text"]))),
    CONSTRAINT "invoices_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'paid'::"text", 'void'::"text"])))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "type" "text" DEFAULT 'text'::"text" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "link" "text",
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['booking'::"text", 'assignment'::"text", 'approval'::"text", 'message'::"text", 'system'::"text", 'parent_link'::"text", 'application'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parent_student_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "parent_student_links_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."parent_student_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text" DEFAULT ''::"text" NOT NULL,
    "role" "text" DEFAULT 'student'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "avatar_url" "text",
    "bio" "text",
    "phone" "text",
    "zoom_link" "text",
    "subjects" "text"[],
    "hourly_rate" numeric(10,2),
    "grade_level" "text",
    "theme" "text" DEFAULT 'light'::"text" NOT NULL,
    "is_onboarded" boolean DEFAULT false NOT NULL,
    "rejection_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepting_students" boolean DEFAULT true NOT NULL,
    "rate_currency" "text" DEFAULT 'ETB'::"text" NOT NULL,
    CONSTRAINT "profiles_rate_currency_check" CHECK (("rate_currency" = ANY (ARRAY['ETB'::"text", 'USD'::"text"]))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['student'::"text", 'tutor'::"text", 'counselor'::"text", 'parent'::"text", 'admin'::"text"]))),
    CONSTRAINT "profiles_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'pending'::"text", 'suspended'::"text", 'rejected'::"text"]))),
    CONSTRAINT "profiles_theme_check" CHECK (("theme" = ANY (ARRAY['light'::"text", 'dark'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recommendations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "recommender_name" "text" NOT NULL,
    "recommender_email" "text",
    "relationship" "text",
    "status" "text" DEFAULT 'requested'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "asked_on" "date",
    "invited_on" "date",
    "submitted_on" "date",
    "ferpa_waived" boolean DEFAULT false NOT NULL,
    "thank_you_sent" boolean DEFAULT false NOT NULL,
    "letter_url" "text",
    CONSTRAINT "recommendations_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'received'::"text", 'submitted'::"text"])))
);


ALTER TABLE "public"."recommendations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."recommendations"."letter_url" IS 'Exception path only. US college letters are submitted by the recommender directly to Common App and are never handled by the student.';



CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "tutor_id" "uuid" NOT NULL,
    "course_id" "uuid",
    "subject" "text" NOT NULL,
    "date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "duration_minutes" integer DEFAULT 60 NOT NULL,
    "mode" "text" DEFAULT 'online'::"text" NOT NULL,
    "zoom_link" "text",
    "status" "text" DEFAULT 'upcoming'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "meeting_room_id" "text",
    "zoom_meeting_id" "text",
    "zoom_password" "text",
    CONSTRAINT "sessions_mode_check" CHECK (("mode" = ANY (ARRAY['online'::"text", 'in-person'::"text", 'both'::"text"]))),
    CONSTRAINT "sessions_status_check" CHECK (("status" = ANY (ARRAY['upcoming'::"text", 'completed'::"text", 'cancelled'::"text", 'no-show'::"text"])))
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_academics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "gpa" numeric(4,2),
    "gpa_scale" numeric(4,2) DEFAULT 4.0,
    "sat_score" integer,
    "act_score" integer,
    "toefl_score" integer,
    "ap_courses" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."student_academics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "drive_file_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "mime_type" "text",
    "web_view_link" "text",
    "size_bytes" bigint,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "student_documents_kind_check" CHECK (("kind" = ANY (ARRAY['transcript'::"text", 'test_score'::"text", 'essay'::"text", 'recommendation'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."student_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "drive_url" "text",
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "tutor_feedback" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    CONSTRAINT "submissions_status_check" CHECK (("status" = ANY (ARRAY['submitted'::"text", 'reviewed'::"text", 'revision_needed'::"text"])))
);


ALTER TABLE "public"."submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tutor_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tutor_id" "uuid" NOT NULL,
    "time_grid" integer[] DEFAULT '{}'::integer[] NOT NULL,
    "disabled_days" integer[] DEFAULT '{}'::integer[] NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tutor_availability" OWNER TO "postgres";


ALTER TABLE ONLY "public"."application_requirements"
    ADD CONSTRAINT "application_requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."application_tasks"
    ADD CONSTRAINT "application_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_customers"
    ADD CONSTRAINT "billing_customers_pkey" PRIMARY KEY ("profile_id");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_services"
    ADD CONSTRAINT "child_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_services"
    ADD CONSTRAINT "child_services_student_id_service_key" UNIQUE ("student_id", "service");



ALTER TABLE ONLY "public"."college_guide_applications"
    ADD CONSTRAINT "college_guide_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."college_list_items"
    ADD CONSTRAINT "college_list_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_messages"
    ADD CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."essays"
    ADD CONSTRAINT "essays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parent_student_links"
    ADD CONSTRAINT "parent_student_links_parent_id_student_id_key" UNIQUE ("parent_id", "student_id");



ALTER TABLE ONLY "public"."parent_student_links"
    ADD CONSTRAINT "parent_student_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recommendations"
    ADD CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_academics"
    ADD CONSTRAINT "student_academics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_academics"
    ADD CONSTRAINT "student_academics_student_id_key" UNIQUE ("student_id");



ALTER TABLE ONLY "public"."student_documents"
    ADD CONSTRAINT "student_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_documents"
    ADD CONSTRAINT "student_documents_student_id_drive_file_id_key" UNIQUE ("student_id", "drive_file_id");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_assignment_id_student_id_key" UNIQUE ("assignment_id", "student_id");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tutor_availability"
    ADD CONSTRAINT "tutor_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tutor_availability"
    ADD CONSTRAINT "tutor_availability_tutor_id_key" UNIQUE ("tutor_id");



CREATE INDEX "application_requirements_item_idx" ON "public"."application_requirements" USING "btree" ("college_list_item_id");



CREATE INDEX "application_tasks_student_idx" ON "public"."application_tasks" USING "btree" ("student_id");



CREATE INDEX "child_services_student_idx" ON "public"."child_services" USING "btree" ("student_id");



CREATE INDEX "college_list_items_student_idx" ON "public"."college_list_items" USING "btree" ("student_id");



CREATE INDEX "essays_student_idx" ON "public"."essays" USING "btree" ("student_id");



CREATE INDEX "invoices_parent_idx" ON "public"."invoices" USING "btree" ("parent_id");



CREATE INDEX "invoices_payout_status_idx" ON "public"."invoices" USING "btree" ("payout_status");



CREATE INDEX "invoices_status_idx" ON "public"."invoices" USING "btree" ("status");



CREATE INDEX "notifications_is_read_idx" ON "public"."notifications" USING "btree" ("user_id", "is_read");



CREATE INDEX "notifications_user_id_idx" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "rec_outstanding_idx" ON "public"."recommendations" USING "btree" ("student_id") WHERE ("status" <> 'submitted'::"text");



CREATE INDEX "recommendations_student_idx" ON "public"."recommendations" USING "btree" ("student_id");



CREATE INDEX "sessions_date_idx" ON "public"."sessions" USING "btree" ("date");



CREATE INDEX "sessions_student_id_idx" ON "public"."sessions" USING "btree" ("student_id");



CREATE INDEX "sessions_tutor_id_idx" ON "public"."sessions" USING "btree" ("tutor_id");



CREATE INDEX "student_documents_kind_idx" ON "public"."student_documents" USING "btree" ("student_id", "kind");



CREATE OR REPLACE TRIGGER "application_requirements_updated_at" BEFORE UPDATE ON "public"."application_requirements" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "application_tasks_updated_at" BEFORE UPDATE ON "public"."application_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "assignments_updated_at" BEFORE UPDATE ON "public"."assignments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "billing_customers_updated_at" BEFORE UPDATE ON "public"."billing_customers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "child_services_updated_at" BEFORE UPDATE ON "public"."child_services" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "college_guide_updated_at" BEFORE UPDATE ON "public"."college_guide_applications" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "college_list_items_updated_at" BEFORE UPDATE ON "public"."college_list_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "courses_updated_at" BEFORE UPDATE ON "public"."courses" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "essays_updated_at" BEFORE UPDATE ON "public"."essays" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "invoices_updated_at" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "parent_student_links_updated_at" BEFORE UPDATE ON "public"."parent_student_links" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "recommendations_updated_at" BEFORE UPDATE ON "public"."recommendations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "sessions_updated_at" BEFORE UPDATE ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "student_academics_updated_at" BEFORE UPDATE ON "public"."student_academics" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."application_requirements"
    ADD CONSTRAINT "application_requirements_college_list_item_id_fkey" FOREIGN KEY ("college_list_item_id") REFERENCES "public"."college_list_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_tasks"
    ADD CONSTRAINT "application_tasks_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_customers"
    ADD CONSTRAINT "billing_customers_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_services"
    ADD CONSTRAINT "child_services_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."college_guide_applications"
    ADD CONSTRAINT "college_guide_applications_counselor_id_fkey" FOREIGN KEY ("counselor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."college_guide_applications"
    ADD CONSTRAINT "college_guide_applications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."college_list_items"
    ADD CONSTRAINT "college_list_items_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."essays"
    ADD CONSTRAINT "essays_college_list_item_id_fkey" FOREIGN KEY ("college_list_item_id") REFERENCES "public"."college_list_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."essays"
    ADD CONSTRAINT "essays_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parent_student_links"
    ADD CONSTRAINT "parent_student_links_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parent_student_links"
    ADD CONSTRAINT "parent_student_links_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recommendations"
    ADD CONSTRAINT "recommendations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_academics"
    ADD CONSTRAINT "student_academics_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tutor_availability"
    ADD CONSTRAINT "tutor_availability_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Admin can manage courses" ON "public"."courses" USING ("public"."is_admin"());



CREATE POLICY "Admin can update any profile" ON "public"."profiles" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admin can view all applications" ON "public"."college_guide_applications" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admin sees all sessions" ON "public"."sessions" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Allow authenticated reads" ON "public"."contact_messages" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow public inserts" ON "public"."contact_messages" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can view active courses" ON "public"."courses" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view tutor availability" ON "public"."tutor_availability" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can insert notifications" ON "public"."notifications" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Counselors can view and update all applications" ON "public"."college_guide_applications" USING ("public"."is_counselor"());



CREATE POLICY "Enable all access for anon" ON "public"."blog_posts" TO "anon" USING (true);



CREATE POLICY "Enable all access for authenticated users" ON "public"."blog_posts" TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all" ON "public"."blog_posts" FOR SELECT USING (true);



CREATE POLICY "Parents can create link requests" ON "public"."parent_student_links" FOR INSERT WITH CHECK (("auth"."uid"() = "parent_id"));



CREATE POLICY "Parents can view linked student applications" ON "public"."college_guide_applications" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."parent_student_links" "psl"
  WHERE (("psl"."parent_id" = "auth"."uid"()) AND ("psl"."student_id" = "college_guide_applications"."student_id") AND ("psl"."status" = 'active'::"text")))));



CREATE POLICY "Parents see linked student sessions" ON "public"."sessions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."parent_student_links" "psl"
  WHERE (("psl"."parent_id" = "auth"."uid"()) AND ("psl"."student_id" = "sessions"."student_id") AND ("psl"."status" = 'active'::"text")))));



CREATE POLICY "Parents see their own link requests" ON "public"."parent_student_links" FOR SELECT USING (("auth"."uid"() = "parent_id"));



CREATE POLICY "Students can approve/reject link requests" ON "public"."parent_student_links" FOR UPDATE USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Students can book sessions" ON "public"."sessions" FOR INSERT WITH CHECK (("auth"."uid"() = "student_id"));



CREATE POLICY "Students can submit applications" ON "public"."college_guide_applications" FOR INSERT WITH CHECK (("auth"."uid"() = "student_id"));



CREATE POLICY "Students can update their own applications" ON "public"."college_guide_applications" FOR UPDATE USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Students manage their own submissions" ON "public"."submissions" USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Students see incoming link requests" ON "public"."parent_student_links" FOR SELECT USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Students see their own applications" ON "public"."college_guide_applications" FOR SELECT USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Students see their own sessions" ON "public"."sessions" FOR SELECT USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Students view assignments for their courses" ON "public"."assignments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."course_id" = "assignments"."course_id") AND ("s"."student_id" = "auth"."uid"())))));



CREATE POLICY "Tutors can update their sessions (notes, status)" ON "public"."sessions" FOR UPDATE USING (("auth"."uid"() = "tutor_id"));



CREATE POLICY "Tutors manage their assignments" ON "public"."assignments" USING (("auth"."uid"() = "tutor_id"));



CREATE POLICY "Tutors manage their own availability" ON "public"."tutor_availability" USING (("auth"."uid"() = "tutor_id"));



CREATE POLICY "Tutors see their own sessions" ON "public"."sessions" FOR SELECT USING (("auth"."uid"() = "tutor_id"));



CREATE POLICY "Tutors view and review submissions for their assignments" ON "public"."submissions" USING ((EXISTS ( SELECT 1
   FROM "public"."assignments" "a"
  WHERE (("a"."id" = "submissions"."assignment_id") AND ("a"."tutor_id" = "auth"."uid"())))));



CREATE POLICY "Users can mark their notifications read" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view all profiles" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Users see their own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."application_requirements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "application_requirements_counselor_all" ON "public"."application_requirements" USING ("public"."is_counselor"()) WITH CHECK ("public"."is_counselor"());



CREATE POLICY "application_requirements_parent_select" ON "public"."application_requirements" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."college_list_items" "cli"
     JOIN "public"."parent_student_links" "psl" ON ((("psl"."student_id" = "cli"."student_id") AND ("psl"."parent_id" = "auth"."uid"()) AND ("psl"."status" = 'active'::"text"))))
  WHERE ("cli"."id" = "application_requirements"."college_list_item_id"))));



CREATE POLICY "application_requirements_student_all" ON "public"."application_requirements" USING ((EXISTS ( SELECT 1
   FROM "public"."college_list_items" "cli"
  WHERE (("cli"."id" = "application_requirements"."college_list_item_id") AND ("cli"."student_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."college_list_items" "cli"
  WHERE (("cli"."id" = "application_requirements"."college_list_item_id") AND ("cli"."student_id" = "auth"."uid"())))));



ALTER TABLE "public"."application_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "application_tasks_counselor_all" ON "public"."application_tasks" USING ("public"."is_counselor"()) WITH CHECK ("public"."is_counselor"());



CREATE POLICY "application_tasks_parent_select" ON "public"."application_tasks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."parent_student_links" "psl"
  WHERE (("psl"."parent_id" = "auth"."uid"()) AND ("psl"."status" = 'active'::"text") AND ("psl"."student_id" = "application_tasks"."student_id")))));



CREATE POLICY "application_tasks_student_all" ON "public"."application_tasks" USING (("auth"."uid"() = "student_id")) WITH CHECK (("auth"."uid"() = "student_id"));



ALTER TABLE "public"."assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "billing_customers_self_select" ON "public"."billing_customers" FOR SELECT USING (("auth"."uid"() = "profile_id"));



ALTER TABLE "public"."blog_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "child_services_admin_all" ON "public"."child_services" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "child_services_parent_all" ON "public"."child_services" USING ((EXISTS ( SELECT 1
   FROM "public"."parent_student_links" "psl"
  WHERE (("psl"."parent_id" = "auth"."uid"()) AND ("psl"."status" = 'active'::"text") AND ("psl"."student_id" = "child_services"."student_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."parent_student_links" "psl"
  WHERE (("psl"."parent_id" = "auth"."uid"()) AND ("psl"."status" = 'active'::"text") AND ("psl"."student_id" = "child_services"."student_id")))));



CREATE POLICY "child_services_student_select" ON "public"."child_services" FOR SELECT USING (("auth"."uid"() = "student_id"));



ALTER TABLE "public"."college_guide_applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "college_guide_applications_counselor_all" ON "public"."college_guide_applications" USING ("public"."is_counselor"()) WITH CHECK ("public"."is_counselor"());



CREATE POLICY "college_guide_applications_parent_select" ON "public"."college_guide_applications" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."parent_student_links" "psl"
  WHERE (("psl"."parent_id" = "auth"."uid"()) AND ("psl"."status" = 'active'::"text") AND ("psl"."student_id" = "college_guide_applications"."student_id")))));



CREATE POLICY "college_guide_applications_student_all" ON "public"."college_guide_applications" USING (("auth"."uid"() = "student_id")) WITH CHECK (("auth"."uid"() = "student_id"));



ALTER TABLE "public"."college_list_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "college_list_items_counselor_all" ON "public"."college_list_items" USING ("public"."is_counselor"()) WITH CHECK ("public"."is_counselor"());



CREATE POLICY "college_list_items_parent_select" ON "public"."college_list_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."parent_student_links" "psl"
  WHERE (("psl"."parent_id" = "auth"."uid"()) AND ("psl"."status" = 'active'::"text") AND ("psl"."student_id" = "college_list_items"."student_id")))));



CREATE POLICY "college_list_items_student_all" ON "public"."college_list_items" USING (("auth"."uid"() = "student_id")) WITH CHECK (("auth"."uid"() = "student_id"));



ALTER TABLE "public"."contact_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conv_insert" ON "public"."conversations" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "conv_select" ON "public"."conversations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "conversations"."id") AND ("conversation_participants"."user_id" = "auth"."uid"())))));



CREATE POLICY "conv_update" ON "public"."conversations" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "conversations"."id") AND ("conversation_participants"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."conversation_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversation_participants_parent_select" ON "public"."conversation_participants" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."conversation_participants" "cp2"
     JOIN "public"."parent_student_links" "psl" ON ((("psl"."student_id" = "cp2"."user_id") AND ("psl"."parent_id" = "auth"."uid"()) AND ("psl"."status" = 'active'::"text"))))
  WHERE ("cp2"."conversation_id" = "conversation_participants"."conversation_id"))));



ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversations_parent_select" ON "public"."conversations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."conversation_participants" "cp"
     JOIN "public"."parent_student_links" "psl" ON ((("psl"."student_id" = "cp"."user_id") AND ("psl"."parent_id" = "auth"."uid"()) AND ("psl"."status" = 'active'::"text"))))
  WHERE ("cp"."conversation_id" = "conversations"."id"))));



ALTER TABLE "public"."courses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cp_insert" ON "public"."conversation_participants" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "cp_select" ON "public"."conversation_participants" FOR SELECT USING (true);



ALTER TABLE "public"."essays" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "essays_counselor_all" ON "public"."essays" USING ("public"."is_counselor"()) WITH CHECK ("public"."is_counselor"());



CREATE POLICY "essays_parent_select" ON "public"."essays" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."parent_student_links" "psl"
  WHERE (("psl"."parent_id" = "auth"."uid"()) AND ("psl"."status" = 'active'::"text") AND ("psl"."student_id" = "essays"."student_id")))));



CREATE POLICY "essays_student_all" ON "public"."essays" USING (("auth"."uid"() = "student_id")) WITH CHECK (("auth"."uid"() = "student_id"));



ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoices_admin_all" ON "public"."invoices" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "invoices_parent_select" ON "public"."invoices" FOR SELECT USING (("auth"."uid"() = "parent_id"));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_parent_select" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."conversation_participants" "cp"
     JOIN "public"."parent_student_links" "psl" ON ((("psl"."student_id" = "cp"."user_id") AND ("psl"."parent_id" = "auth"."uid"()) AND ("psl"."status" = 'active'::"text"))))
  WHERE ("cp"."conversation_id" = "messages"."conversation_id"))));



CREATE POLICY "msg_insert" ON "public"."messages" FOR INSERT WITH CHECK ((("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "messages"."conversation_id") AND ("conversation_participants"."user_id" = "auth"."uid"()))))));



CREATE POLICY "msg_select" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "messages"."conversation_id") AND ("conversation_participants"."user_id" = "auth"."uid"())))));



CREATE POLICY "msg_update" ON "public"."messages" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "messages"."conversation_id") AND ("conversation_participants"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parent_student_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recommendations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recommendations_counselor_all" ON "public"."recommendations" USING ("public"."is_counselor"()) WITH CHECK ("public"."is_counselor"());



CREATE POLICY "recommendations_parent_select" ON "public"."recommendations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."parent_student_links" "psl"
  WHERE (("psl"."parent_id" = "auth"."uid"()) AND ("psl"."status" = 'active'::"text") AND ("psl"."student_id" = "recommendations"."student_id")))));



CREATE POLICY "recommendations_student_all" ON "public"."recommendations" USING (("auth"."uid"() = "student_id")) WITH CHECK (("auth"."uid"() = "student_id"));



ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_academics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_academics_counselor_all" ON "public"."student_academics" USING ("public"."is_counselor"()) WITH CHECK ("public"."is_counselor"());



CREATE POLICY "student_academics_parent_select" ON "public"."student_academics" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."parent_student_links" "psl"
  WHERE (("psl"."parent_id" = "auth"."uid"()) AND ("psl"."status" = 'active'::"text") AND ("psl"."student_id" = "student_academics"."student_id")))));



CREATE POLICY "student_academics_student_all" ON "public"."student_academics" USING (("auth"."uid"() = "student_id")) WITH CHECK (("auth"."uid"() = "student_id"));



ALTER TABLE "public"."student_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tutor_availability" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."conversation_participants";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."conversations";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_counselor"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_counselor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_counselor"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."application_requirements" TO "anon";
GRANT ALL ON TABLE "public"."application_requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."application_requirements" TO "service_role";



GRANT ALL ON TABLE "public"."application_tasks" TO "anon";
GRANT ALL ON TABLE "public"."application_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."application_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."assignments" TO "anon";
GRANT ALL ON TABLE "public"."assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."assignments" TO "service_role";



GRANT ALL ON TABLE "public"."billing_customers" TO "anon";
GRANT ALL ON TABLE "public"."billing_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_customers" TO "service_role";



GRANT ALL ON TABLE "public"."blog_posts" TO "anon";
GRANT ALL ON TABLE "public"."blog_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_posts" TO "service_role";



GRANT ALL ON TABLE "public"."child_services" TO "anon";
GRANT ALL ON TABLE "public"."child_services" TO "authenticated";
GRANT ALL ON TABLE "public"."child_services" TO "service_role";



GRANT ALL ON TABLE "public"."college_guide_applications" TO "anon";
GRANT ALL ON TABLE "public"."college_guide_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."college_guide_applications" TO "service_role";



GRANT ALL ON TABLE "public"."college_list_items" TO "anon";
GRANT ALL ON TABLE "public"."college_list_items" TO "authenticated";
GRANT ALL ON TABLE "public"."college_list_items" TO "service_role";



GRANT ALL ON TABLE "public"."contact_messages" TO "anon";
GRANT ALL ON TABLE "public"."contact_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_messages" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_participants" TO "anon";
GRANT ALL ON TABLE "public"."conversation_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_participants" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."courses" TO "anon";
GRANT ALL ON TABLE "public"."courses" TO "authenticated";
GRANT ALL ON TABLE "public"."courses" TO "service_role";



GRANT ALL ON TABLE "public"."essays" TO "anon";
GRANT ALL ON TABLE "public"."essays" TO "authenticated";
GRANT ALL ON TABLE "public"."essays" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."parent_student_links" TO "anon";
GRANT ALL ON TABLE "public"."parent_student_links" TO "authenticated";
GRANT ALL ON TABLE "public"."parent_student_links" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."recommendations" TO "anon";
GRANT ALL ON TABLE "public"."recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."recommendations" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."student_academics" TO "anon";
GRANT ALL ON TABLE "public"."student_academics" TO "authenticated";
GRANT ALL ON TABLE "public"."student_academics" TO "service_role";



GRANT ALL ON TABLE "public"."student_documents" TO "anon";
GRANT ALL ON TABLE "public"."student_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."student_documents" TO "service_role";



GRANT ALL ON TABLE "public"."submissions" TO "anon";
GRANT ALL ON TABLE "public"."submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."submissions" TO "service_role";



GRANT ALL ON TABLE "public"."tutor_availability" TO "anon";
GRANT ALL ON TABLE "public"."tutor_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."tutor_availability" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































