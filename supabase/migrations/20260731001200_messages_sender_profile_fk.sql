-- messages.sender_id gets a foreign key to profiles.
--
-- It already references auth.users, which is correct but leaves PostgREST with
-- no relationship to follow: embedding the sender's name in a query over
-- messages fails with PGRST200, so every caller has to fetch the profiles
-- separately and stitch them together. The admin reports queue hit exactly
-- that.
--
-- Both keys can coexist. profiles.id is itself a foreign key to auth.users.id
-- with ON DELETE CASCADE, so a profile exists for every account and disappears
-- with it. Adding this constrains nothing new, it just makes the relationship
-- one the API can see.
--
-- NOT VALID then VALIDATE so the existing rows are checked without holding an
-- ACCESS EXCLUSIVE lock on messages for the length of the scan.

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_sender_profile_fkey;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_sender_profile_fkey
  FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.messages
  VALIDATE CONSTRAINT messages_sender_profile_fkey;
