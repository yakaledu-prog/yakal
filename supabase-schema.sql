-- 1. Create the profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  role text DEFAULT 'student',
  avatar_url text,
  theme text DEFAULT 'light',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow public read access to profiles (or restrict as needed)
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING ( true );

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK ( auth.uid() = id );

-- Users can update their own profile
CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE
  USING ( auth.uid() = id );

-- 2. Set up a trigger to automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://i.pravatar.cc/150?u=' || NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 3. Seed Demo Users into auth.users (Trigger will auto-create profiles)
-- Note: We use pgcrypto to hash the 'demo123' password.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@yakal.com',
    crypt('demo123', gen_salt('bf')),
    now(),
    '{"full_name":"Almaz T.","role":"admin","avatar_url":"https://i.pravatar.cc/150?u=admin_yakal"}'::jsonb,
    now(),
    now(),
    '', '', '', ''
  ),
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'parent@yakal.com',
    crypt('demo123', gen_salt('bf')),
    now(),
    '{"full_name":"Tigist Worku","role":"parent","avatar_url":"https://i.pravatar.cc/150?u=parent_yakal"}'::jsonb,
    now(),
    now(),
    '', '', '', ''
  ),
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'student@yakal.com',
    crypt('demo123', gen_salt('bf')),
    now(),
    '{"full_name":"Amen Worku","role":"student","avatar_url":"https://i.pravatar.cc/150?u=student_yakal"}'::jsonb,
    now(),
    now(),
    '', '', '', ''
  ),
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'tutor@yakal.com',
    crypt('demo123', gen_salt('bf')),
    now(),
    '{"full_name":"Bethlehem A.","role":"tutor","avatar_url":"https://i.pravatar.cc/150?u=tutor_yakal"}'::jsonb,
    now(),
    now(),
    '', '', '', ''
  );

-- Also add to auth.identities so they can login properly without Supabase complaints
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT 
  gen_random_uuid(), 
  id, 
  id::text, 
  jsonb_build_object('sub', id, 'email', email), 
  'email', 
  now(), 
  now(), 
  now()
FROM auth.users
WHERE email IN ('admin@yakal.com', 'parent@yakal.com', 'student@yakal.com', 'tutor@yakal.com')
AND NOT EXISTS (
  SELECT 1 FROM auth.identities WHERE user_id = auth.users.id
);
