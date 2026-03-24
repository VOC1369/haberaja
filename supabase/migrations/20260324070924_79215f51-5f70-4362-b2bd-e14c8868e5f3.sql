
UPDATE auth.users
SET 
  email_confirmed_at = NOW(),
  updated_at = NOW()
WHERE email = 'vaultofcodex@gmail.com'
  AND email_confirmed_at IS NULL;
