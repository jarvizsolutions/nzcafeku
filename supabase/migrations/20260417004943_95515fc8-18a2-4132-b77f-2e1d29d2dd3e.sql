-- 1. Reset password for hello@gmail.com to "Hello@123"
UPDATE auth.users
SET 
  encrypted_password = crypt('Hello@123', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now()
WHERE email = 'hello@gmail.com';

-- 2. Grant admin role (idempotent)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'hello@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;