DO $$
DECLARE
  admin_uid UUID;
BEGIN
  -- Pega o ID do admin
  SELECT id INTO admin_uid FROM auth.users WHERE email = 'tanamaoprod2026@outlook.com';

  IF admin_uid IS NOT NULL THEN
    -- Insere a identidade com a coluna provider_id preenchida
    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = admin_uid) THEN
      INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        admin_uid,
        admin_uid::text, -- CORREÇÃO: Adicionado o provider_id
        format('{"sub":"%s","email":"%s"}', admin_uid::text, 'tanamaoprod2026@outlook.com')::jsonb,
        'email',
        now(),
        now()
      );
    END IF;
  END IF;
END $$;
