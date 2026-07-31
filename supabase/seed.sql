-- ============================================================
-- Local development seed.
--
-- Runs automatically on `supabase db reset` and on the first
-- `supabase start`. Mirrors the demo data from the hosted project so the
-- local stack behaves like the environment the UI was built against.
--
-- Every account below has the password 'demo123', matching the one-click
-- demo logins on the sign-in page. Emails are pre-confirmed, so signing in
-- works offline with no mail round trip. New signups you make by hand go
-- to Mailpit at http://localhost:54324 instead of a real inbox.
--
-- DO NOT run this against the hosted project.
-- ============================================================

-- The auth.users insert fires public.handle_new_user(), which creates the
-- matching public.profiles row from raw_user_meta_data. Profile columns the
-- trigger does not set are filled in afterwards.

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new, is_super_admin
) VALUES
  ('00000000-0000-0000-0000-000000000000', '82b1793a-db13-49ee-a81a-9e02a5cb51fd', 'authenticated', 'authenticated',
   'admin@yakal.com', extensions.crypt('demo123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name": "Almaz Tadesse", "role": "admin"}'::jsonb,
   '2026-07-05T07:07:48.956849+00:00', now(), '', '', '', '', false),
  ('00000000-0000-0000-0000-000000000000', '44464c4b-6111-41ab-b749-a0bc03f94e9d', 'authenticated', 'authenticated',
   'binyam2537@gmail.com', extensions.crypt('demo123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name": "binyam", "role": "tutor", "avatar_url": "https://api.dicebear.com/9.x/initials/svg?seed=binyam"}'::jsonb,
   '2026-07-09T19:44:21.4725+00:00', now(), '', '', '', '', false),
  ('00000000-0000-0000-0000-000000000000', '861ab9d4-186c-46c9-bbcf-ed392fe34343', 'authenticated', 'authenticated',
   'counselor@yakal.com', extensions.crypt('demo123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name": "Daniel Haile", "role": "counselor", "avatar_url": "https://ghruwaysryzfdiagzqfz.supabase.co/storage/v1/object/public/avatars/861ab9d4-186c-46c9-bbcf-ed392fe34343/1785411508635.webp"}'::jsonb,
   '2026-07-05T07:07:48.956849+00:00', now(), '', '', '', '', false),
  ('00000000-0000-0000-0000-000000000000', '39b5cc44-5ce1-4822-9414-01c27a9bb940', 'authenticated', 'authenticated',
   'tutor@yakal.com', extensions.crypt('demo123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name": "Bethlehem Alemu", "role": "tutor", "avatar_url": "https://ghruwaysryzfdiagzqfz.supabase.co/storage/v1/object/public/avatars/39b5cc44-5ce1-4822-9414-01c27a9bb940/1784205504536.jpg"}'::jsonb,
   '2026-07-05T07:07:48.956849+00:00', now(), '', '', '', '', false),
  ('00000000-0000-0000-0000-000000000000', '9ef3ccc6-977b-44b2-8694-45c27d1e5a09', 'authenticated', 'authenticated',
   'student@yakal.com', extensions.crypt('demo123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name": "Amen Worku", "role": "student"}'::jsonb,
   '2026-07-05T07:07:48.956849+00:00', now(), '', '', '', '', false),
  ('00000000-0000-0000-0000-000000000000', '93f02d1b-fcef-4ad5-beb7-2ee6b7042cd7', 'authenticated', 'authenticated',
   'binyammamo01@gmail.com', extensions.crypt('demo123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name": "Binyam", "role": "parent"}'::jsonb,
   '2026-07-22T18:53:56.525307+00:00', now(), '', '', '', '', false),
  ('00000000-0000-0000-0000-000000000000', '1bcda665-40a3-40e3-b613-fcaf5ca93b9f', 'authenticated', 'authenticated',
   'parent@yakal.com', extensions.crypt('demo123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name": "Tigist Worku", "role": "parent", "avatar_url": "https://api.dicebear.com/9.x/initials/svg?seed=Tigist%20Worku"}'::jsonb,
   '2026-07-05T07:07:48.956849+00:00', now(), '', '', '', '', false);

-- GoTrue resolves a password login through auth.identities, so each user
-- needs the matching email identity row.
INSERT INTO auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) VALUES
  ('82b1793a-db13-49ee-a81a-9e02a5cb51fd', '82b1793a-db13-49ee-a81a-9e02a5cb51fd', '{"sub": "82b1793a-db13-49ee-a81a-9e02a5cb51fd", "email": "admin@yakal.com", "email_verified": true, "phone_verified": false}'::jsonb, 'email', now(), now(), now()),
  ('44464c4b-6111-41ab-b749-a0bc03f94e9d', '44464c4b-6111-41ab-b749-a0bc03f94e9d', '{"sub": "44464c4b-6111-41ab-b749-a0bc03f94e9d", "email": "binyam2537@gmail.com", "email_verified": true, "phone_verified": false}'::jsonb, 'email', now(), now(), now()),
  ('861ab9d4-186c-46c9-bbcf-ed392fe34343', '861ab9d4-186c-46c9-bbcf-ed392fe34343', '{"sub": "861ab9d4-186c-46c9-bbcf-ed392fe34343", "email": "counselor@yakal.com", "email_verified": true, "phone_verified": false}'::jsonb, 'email', now(), now(), now()),
  ('39b5cc44-5ce1-4822-9414-01c27a9bb940', '39b5cc44-5ce1-4822-9414-01c27a9bb940', '{"sub": "39b5cc44-5ce1-4822-9414-01c27a9bb940", "email": "tutor@yakal.com", "email_verified": true, "phone_verified": false}'::jsonb, 'email', now(), now(), now()),
  ('9ef3ccc6-977b-44b2-8694-45c27d1e5a09', '9ef3ccc6-977b-44b2-8694-45c27d1e5a09', '{"sub": "9ef3ccc6-977b-44b2-8694-45c27d1e5a09", "email": "student@yakal.com", "email_verified": true, "phone_verified": false}'::jsonb, 'email', now(), now(), now()),
  ('93f02d1b-fcef-4ad5-beb7-2ee6b7042cd7', '93f02d1b-fcef-4ad5-beb7-2ee6b7042cd7', '{"sub": "93f02d1b-fcef-4ad5-beb7-2ee6b7042cd7", "email": "binyammamo01@gmail.com", "email_verified": true, "phone_verified": false}'::jsonb, 'email', now(), now(), now()),
  ('1bcda665-40a3-40e3-b613-fcaf5ca93b9f', '1bcda665-40a3-40e3-b613-fcaf5ca93b9f', '{"sub": "1bcda665-40a3-40e3-b613-fcaf5ca93b9f", "email": "parent@yakal.com", "email_verified": true, "phone_verified": false}'::jsonb, 'email', now(), now(), now());

-- Fill in the columns handle_new_user() leaves at their defaults. The demo
-- tutor and counselor are pre-approved here; the real signup flow would
-- leave them 'pending' until an admin approves them.
UPDATE public.profiles SET
      email = 'admin@yakal.com',
      full_name = 'Almaz Tadesse',
      role = 'admin',
      status = 'active',
      avatar_url = NULL,
      bio = 'Platform Super Administrator. Oversees all tutors, students, and platform operations.',
      phone = '+251911000001',
      zoom_link = NULL,
      subjects = NULL,
      hourly_rate = NULL,
      grade_level = NULL,
      theme = 'light',
      is_onboarded = true,
      accepting_students = true,
      rate_currency = 'ETB'
  WHERE id = '82b1793a-db13-49ee-a81a-9e02a5cb51fd';
UPDATE public.profiles SET
      email = 'binyam2537@gmail.com',
      full_name = 'binyam',
      role = 'tutor',
      status = 'active',
      avatar_url = 'https://api.dicebear.com/9.x/initials/svg?seed=binyam',
      bio = NULL,
      phone = NULL,
      zoom_link = NULL,
      subjects = '{"Mathematics"}',
      hourly_rate = NULL,
      grade_level = NULL,
      theme = 'light',
      is_onboarded = true,
      accepting_students = true,
      rate_currency = 'ETB'
  WHERE id = '44464c4b-6111-41ab-b749-a0bc03f94e9d';
UPDATE public.profiles SET
      email = 'counselor@yakal.com',
      full_name = 'Daniel Haile',
      role = 'counselor',
      status = 'active',
      avatar_url = 'https://ghruwaysryzfdiagzqfz.supabase.co/storage/v1/object/public/avatars/861ab9d4-186c-46c9-bbcf-ed392fe34343/1785411508635.webp',
      bio = 'College admissions counselor with expertise in Ethiopian and international university applications. Helped 200+ students achieve their academic dreams.',
      phone = '+251911000003',
      zoom_link = NULL,
      subjects = NULL,
      hourly_rate = NULL,
      grade_level = NULL,
      theme = 'light',
      is_onboarded = true,
      accepting_students = true,
      rate_currency = 'ETB'
  WHERE id = '861ab9d4-186c-46c9-bbcf-ed392fe34343';
UPDATE public.profiles SET
      email = 'tutor@yakal.com',
      full_name = 'Bethlehem Alemu',
      role = 'tutor',
      status = 'active',
      avatar_url = 'https://ghruwaysryzfdiagzqfz.supabase.co/storage/v1/object/public/avatars/39b5cc44-5ce1-4822-9414-01c27a9bb940/1784205504536.jpg',
      bio = 'Senior Mathematics and Physics tutor with 8 years of experience. Specializes in SAT Prep and University Entrance Exams.',
      phone = '+251911000002',
      zoom_link = 'https://meet.google.com/demo-tutor-link',
      subjects = '{"Mathematics","Physics","SAT Prep"}',
      hourly_rate = 500.0,
      grade_level = NULL,
      theme = 'light',
      is_onboarded = true,
      accepting_students = true,
      rate_currency = 'ETB'
  WHERE id = '39b5cc44-5ce1-4822-9414-01c27a9bb940';
UPDATE public.profiles SET
      email = 'student@yakal.com',
      full_name = 'Amen Worku',
      role = 'student',
      status = 'active',
      avatar_url = NULL,
      bio = 'Grade 12 student preparing for university entrance exams. Focusing on Mathematics and Physics.',
      phone = '+251911000005',
      zoom_link = NULL,
      subjects = NULL,
      hourly_rate = NULL,
      grade_level = 'Grade 12',
      theme = 'light',
      is_onboarded = true,
      accepting_students = true,
      rate_currency = 'ETB'
  WHERE id = '9ef3ccc6-977b-44b2-8694-45c27d1e5a09';
UPDATE public.profiles SET
      email = 'binyammamo01@gmail.com',
      full_name = 'Binyam',
      role = 'parent',
      status = 'active',
      avatar_url = NULL,
      bio = NULL,
      phone = NULL,
      zoom_link = NULL,
      subjects = NULL,
      hourly_rate = NULL,
      grade_level = NULL,
      theme = 'light',
      is_onboarded = false,
      accepting_students = true,
      rate_currency = 'ETB'
  WHERE id = '93f02d1b-fcef-4ad5-beb7-2ee6b7042cd7';
UPDATE public.profiles SET
      email = 'parent@yakal.com',
      full_name = 'Tigist Worku',
      role = 'parent',
      status = 'active',
      avatar_url = 'https://api.dicebear.com/9.x/initials/svg?seed=Tigist%20Worku',
      bio = NULL,
      phone = '+251911000004',
      zoom_link = NULL,
      subjects = NULL,
      hourly_rate = NULL,
      grade_level = NULL,
      theme = 'light',
      is_onboarded = true,
      accepting_students = true,
      rate_currency = 'ETB'
  WHERE id = '1bcda665-40a3-40e3-b613-fcaf5ca93b9f';

-- Parent to child links. Drives the parent's read-only view of a child's chats.
INSERT INTO public.parent_student_links (id, parent_id, student_id, status, created_at, updated_at) VALUES
  ('7274e152-9b94-49f6-b535-53676c3341ef', '1bcda665-40a3-40e3-b613-fcaf5ca93b9f', '9ef3ccc6-977b-44b2-8694-45c27d1e5a09', 'active', '2026-07-05T07:07:48.956849+00:00', '2026-07-05T07:07:48.956849+00:00');

-- Conversations, their participants, and the message history.
-- Note: 1 conversation(s) in the hosted project have only one participant,
-- left behind when getOrCreateConversation failed partway through against the
-- recursive RLS policy. They are not reproduced here.
INSERT INTO public.conversations (id, created_at, updated_at) VALUES
  ('67544cbf-ad6e-4543-9efa-86abf37c1f02', '2026-07-17T22:24:07.241256+00:00', '2026-07-17T22:24:07.241256+00:00'),
  ('730ad212-7455-4481-bce4-5af42fd1fa27', '2026-07-17T22:37:46.740306+00:00', '2026-07-17T22:37:57.713+00:00'),
  ('f8de6b8b-1b5a-4f0a-b4c8-80896f0d7847', '2026-07-17T22:37:03.733378+00:00', '2026-07-18T00:31:11.317+00:00'),
  ('9f65f2dd-8f17-41ca-be51-8f79f044e624', '2026-07-17T23:47:47.668896+00:00', '2026-07-18T00:31:18.632+00:00'),
  ('dfbd0b1b-a9f9-4878-8f6a-dbe44ecbef76', '2026-07-18T00:44:16.642153+00:00', '2026-07-18T00:44:16.642153+00:00'),
  ('3b3f047a-3564-4236-a82a-8642b0c834aa', '2026-07-18T00:41:55.807149+00:00', '2026-07-19T16:14:23.426+00:00'),
  ('21893b4f-c4cc-4fca-bcb1-284f7e2c50a9', '2026-07-19T17:58:02.248373+00:00', '2026-07-19T17:58:02.248373+00:00'),
  ('5248fc78-1c83-4da2-b763-0564ba332ae1', '2026-07-19T17:58:06.243181+00:00', '2026-07-19T17:58:06.243181+00:00'),
  ('0aff995a-a0be-47d6-a2cc-1c3708acb2a8', '2026-07-17T18:54:36.703061+00:00', '2026-07-19T18:15:56.286+00:00');

INSERT INTO public.conversation_participants (conversation_id, user_id, created_at) VALUES
  ('0aff995a-a0be-47d6-a2cc-1c3708acb2a8', '39b5cc44-5ce1-4822-9414-01c27a9bb940', '2026-07-17T18:54:37.607842+00:00'),
  ('0aff995a-a0be-47d6-a2cc-1c3708acb2a8', '9ef3ccc6-977b-44b2-8694-45c27d1e5a09', '2026-07-17T18:54:37.607842+00:00'),
  ('67544cbf-ad6e-4543-9efa-86abf37c1f02', '39b5cc44-5ce1-4822-9414-01c27a9bb940', '2026-07-17T22:24:07.450502+00:00'),
  ('67544cbf-ad6e-4543-9efa-86abf37c1f02', '82b1793a-db13-49ee-a81a-9e02a5cb51fd', '2026-07-17T22:24:07.450502+00:00'),
  ('f8de6b8b-1b5a-4f0a-b4c8-80896f0d7847', '9ef3ccc6-977b-44b2-8694-45c27d1e5a09', '2026-07-17T22:37:03.933488+00:00'),
  ('f8de6b8b-1b5a-4f0a-b4c8-80896f0d7847', '82b1793a-db13-49ee-a81a-9e02a5cb51fd', '2026-07-17T22:37:03.933488+00:00'),
  ('730ad212-7455-4481-bce4-5af42fd1fa27', '39b5cc44-5ce1-4822-9414-01c27a9bb940', '2026-07-17T22:37:47.05583+00:00'),
  ('730ad212-7455-4481-bce4-5af42fd1fa27', '44464c4b-6111-41ab-b749-a0bc03f94e9d', '2026-07-17T22:37:47.05583+00:00'),
  ('9f65f2dd-8f17-41ca-be51-8f79f044e624', '9ef3ccc6-977b-44b2-8694-45c27d1e5a09', '2026-07-17T23:47:48.003355+00:00'),
  ('9f65f2dd-8f17-41ca-be51-8f79f044e624', '44464c4b-6111-41ab-b749-a0bc03f94e9d', '2026-07-17T23:47:48.003355+00:00'),
  ('3b3f047a-3564-4236-a82a-8642b0c834aa', '9ef3ccc6-977b-44b2-8694-45c27d1e5a09', '2026-07-18T00:41:55.987802+00:00'),
  ('3b3f047a-3564-4236-a82a-8642b0c834aa', '1bcda665-40a3-40e3-b613-fcaf5ca93b9f', '2026-07-18T00:41:55.987802+00:00'),
  ('dfbd0b1b-a9f9-4878-8f6a-dbe44ecbef76', '9ef3ccc6-977b-44b2-8694-45c27d1e5a09', '2026-07-18T00:44:16.875539+00:00'),
  ('dfbd0b1b-a9f9-4878-8f6a-dbe44ecbef76', '861ab9d4-186c-46c9-bbcf-ed392fe34343', '2026-07-18T00:44:16.875539+00:00'),
  ('21893b4f-c4cc-4fca-bcb1-284f7e2c50a9', '1bcda665-40a3-40e3-b613-fcaf5ca93b9f', '2026-07-19T17:58:02.490017+00:00'),
  ('21893b4f-c4cc-4fca-bcb1-284f7e2c50a9', '82b1793a-db13-49ee-a81a-9e02a5cb51fd', '2026-07-19T17:58:02.490017+00:00'),
  ('5248fc78-1c83-4da2-b763-0564ba332ae1', '1bcda665-40a3-40e3-b613-fcaf5ca93b9f', '2026-07-19T17:58:06.363901+00:00'),
  ('5248fc78-1c83-4da2-b763-0564ba332ae1', '39b5cc44-5ce1-4822-9414-01c27a9bb940', '2026-07-19T17:58:06.363901+00:00');

INSERT INTO public.messages (id, conversation_id, sender_id, content, type, is_read, created_at) VALUES
  ('0e1b2209-9fac-4854-9494-b6476344a169', '0aff995a-a0be-47d6-a2cc-1c3708acb2a8', '39b5cc44-5ce1-4822-9414-01c27a9bb940', 'hello there', 'text', true, '2026-07-17T18:54:37.854938+00:00'),
  ('03fc627d-22b5-41ec-8726-bca822bddf63', '0aff995a-a0be-47d6-a2cc-1c3708acb2a8', '39b5cc44-5ce1-4822-9414-01c27a9bb940', 'hi', 'text', true, '2026-07-17T18:54:43.605971+00:00'),
  ('05bba0bd-75df-49b1-b8d6-2292a6079ea7', '0aff995a-a0be-47d6-a2cc-1c3708acb2a8', '39b5cc44-5ce1-4822-9414-01c27a9bb940', 'hw', 'text', true, '2026-07-17T18:56:15.786135+00:00'),
  ('2504203b-0467-45c9-a080-2b8e8e5b836c', '0aff995a-a0be-47d6-a2cc-1c3708acb2a8', '39b5cc44-5ce1-4822-9414-01c27a9bb940', 'hello', 'text', true, '2026-07-17T18:56:21.75805+00:00'),
  ('df31636c-1698-41be-b95a-188c193ddb43', '0aff995a-a0be-47d6-a2cc-1c3708acb2a8', '9ef3ccc6-977b-44b2-8694-45c27d1e5a09', 'helo I am fine', 'text', true, '2026-07-17T18:59:14.337021+00:00'),
  ('da47f71e-cf14-4be6-b93d-2bbb5a1e4812', '0aff995a-a0be-47d6-a2cc-1c3708acb2a8', '39b5cc44-5ce1-4822-9414-01c27a9bb940', 'how are you doing', 'text', true, '2026-07-17T18:59:25.470661+00:00'),
  ('d6a9c6eb-a9b1-418f-831e-7dbdbc1848ed', '0aff995a-a0be-47d6-a2cc-1c3708acb2a8', '9ef3ccc6-977b-44b2-8694-45c27d1e5a09', 'I am doing fine how abt u', 'text', true, '2026-07-17T18:59:34.377154+00:00'),
  ('c8de51a3-3b95-4800-a22c-424a06a61807', '0aff995a-a0be-47d6-a2cc-1c3708acb2a8', '39b5cc44-5ce1-4822-9414-01c27a9bb940', 'Good Morning', 'text', true, '2026-07-17T21:26:47.908741+00:00'),
  ('267d21b6-ff3b-4079-a34a-22b1edfca2f1', '0aff995a-a0be-47d6-a2cc-1c3708acb2a8', '9ef3ccc6-977b-44b2-8694-45c27d1e5a09', 'Good', 'text', true, '2026-07-17T21:27:08.892194+00:00'),
  ('e63b868e-b6c2-450a-9084-833b162718b8', '0aff995a-a0be-47d6-a2cc-1c3708acb2a8', '39b5cc44-5ce1-4822-9414-01c27a9bb940', 'hi', 'text', true, '2026-07-17T21:46:14.579757+00:00'),
  ('370a176b-8440-402b-b27d-65ff7ae23243', '0aff995a-a0be-47d6-a2cc-1c3708acb2a8', '9ef3ccc6-977b-44b2-8694-45c27d1e5a09', 'hello how are you', 'text', true, '2026-07-17T21:46:27.704495+00:00'),
  ('f74afc9e-00f6-41be-b5d5-dc15a22fea95', '730ad212-7455-4481-bce4-5af42fd1fa27', '39b5cc44-5ce1-4822-9414-01c27a9bb940', 'hello there', 'text', false, '2026-07-17T22:37:57.362938+00:00'),
  ('80131172-3e2f-4719-9078-923567f6ea83', 'f8de6b8b-1b5a-4f0a-b4c8-80896f0d7847', '9ef3ccc6-977b-44b2-8694-45c27d1e5a09', 'Hello there', 'text', false, '2026-07-18T00:31:11.006835+00:00'),
  ('c919e740-74f0-4107-ade8-ec5c3e2612f1', '9f65f2dd-8f17-41ca-be51-8f79f044e624', '9ef3ccc6-977b-44b2-8694-45c27d1e5a09', 'Good morning there', 'text', false, '2026-07-18T00:31:18.384466+00:00'),
  ('ea360e83-c8ff-4b52-8b14-1bffc69b2c9b', '0aff995a-a0be-47d6-a2cc-1c3708acb2a8', '39b5cc44-5ce1-4822-9414-01c27a9bb940', 'hello', 'text', true, '2026-07-18T09:04:50.284764+00:00'),
  ('3f23f8bd-c152-424c-b889-bc58979dcdc9', '0aff995a-a0be-47d6-a2cc-1c3708acb2a8', '9ef3ccc6-977b-44b2-8694-45c27d1e5a09', 'how u doin', 'text', true, '2026-07-18T09:04:54.030219+00:00'),
  ('9d1ca9f4-b3b7-4565-bb89-5df36d7acff5', '3b3f047a-3564-4236-a82a-8642b0c834aa', '9ef3ccc6-977b-44b2-8694-45c27d1e5a09', 'Good morning', 'text', false, '2026-07-19T16:12:43.56299+00:00'),
  ('0cd26a70-34a3-4380-9a11-6edbc54ea5b3', '3b3f047a-3564-4236-a82a-8642b0c834aa', '1bcda665-40a3-40e3-b613-fcaf5ca93b9f', 'Hello How are you', 'text', false, '2026-07-19T16:13:12.479042+00:00'),
  ('bf416ea7-5139-4879-9989-784977eb129c', '3b3f047a-3564-4236-a82a-8642b0c834aa', '9ef3ccc6-977b-44b2-8694-45c27d1e5a09', 'Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry''s standard dummy text ever since 1966, when designers at Letraset and James Mosley, the librarian at St Bride Printing Library in London, took a 1914 Cicero translation and scrambled it to make dummy text for Letraset''s Body Type sheets. It has survived not only many decades, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised thanks to these sheets and more recently with desktop publishing software like Aldus PageMaker and Microsoft Word including versions of Lorem Ipsum.', 'text', false, '2026-07-19T16:14:23.305094+00:00'),
  ('119e86e2-2699-47fe-9e01-cdc4566aea79', '0aff995a-a0be-47d6-a2cc-1c3708acb2a8', '39b5cc44-5ce1-4822-9414-01c27a9bb940', 'hello', 'text', true, '2026-07-19T18:15:56.271291+00:00');

