-- Run this in your Supabase SQL Editor to add the is_onboarded and email columns

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_onboarded boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS email text;

-- If you have existing demo users that should bypass onboarding, run this:
UPDATE public.profiles SET is_onboarded = true;

-- Update existing profiles with their email from auth.users so you don't lose the emails for already created accounts
UPDATE public.profiles 
SET email = auth.users.email 
FROM auth.users 
WHERE public.profiles.id = auth.users.id;
