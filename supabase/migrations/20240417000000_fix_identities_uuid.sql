-- Fix for auth.identities id column type mismatch (uuid vs text)
DO $$
DECLARE
  admin_uid UUID;
BEGIN
  -- Find the admin user
  SELECT id INTO admin_uid FROM auth.users WHERE email = 'tanamaoprod2026@outlook.com';

  IF admin_uid IS NOT NULL THEN
    -- Check if identity already exists
    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = admin_uid AND provider = 'email') THEN
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), -- CORREÇÃO: Removido o cast ::text, pois a coluna é do tipo UUID
        admin_uid,
        format('{"sub":"%s","email":"%s"}', admin_uid::text, 'tanamaoprod2026@outlook.com')::jsonb,
        'email',
        now(),
        now()
      );
    END IF;
  END IF;
END $$;
