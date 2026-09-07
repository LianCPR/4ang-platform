-- ============================================================
-- 010: Admin Setup
-- Set haidang280611@gmail.com as admin
-- ============================================================

-- Function to promote a user to admin (called after signup)
CREATE OR REPLACE FUNCTION public.promote_to_admin(user_email TEXT)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Find user by email in auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = user_email;
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User with email % not found', user_email;
    RETURN;
  END IF;
  -- Update profile role
  UPDATE public.profiles SET role = 'admin' WHERE id = v_user_id;
  RAISE NOTICE 'User % promoted to admin', user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
SELECT EXISTS (
  SELECT 1 FROM public.profiles WHERE id = user_id AND role = 'admin'
);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Note: The actual admin promotion happens after the user signs up.
-- Run this SQL after the user haidang280611@gmail.com creates their account:
-- SELECT public.promote_to_admin('haidang280611@gmail.com');
--
-- Or in Supabase SQL Editor after the user signs up:
-- UPDATE public.profiles SET role = 'admin' WHERE id = (
--   SELECT id FROM auth.users WHERE email = 'haidang280611@gmail.com'
-- );
