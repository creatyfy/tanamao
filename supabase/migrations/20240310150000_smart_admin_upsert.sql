/*
  # Smart Admin Upsert
  Garante a criação ou atualização do usuário Administrador sem violar as constraints de e-mail do Supabase.

  ## Query Description:
  Este script verifica se o e-mail do admin já existe na tabela auth.users.
  Se existir, ele atualiza a senha e os metadados. Se não existir, ele cria o usuário.
  Em seguida, faz o mesmo para a tabela public.users, garantindo a role 'admin'.
  
  ## Metadata:
  - Schema-Category: "Data"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true
*/

DO $$
DECLARE
  admin_uid UUID := '00000000-0000-0000-0000-000000000000';
  existing_id UUID;
BEGIN
  -- 1. Verifica se o email já existe na tabela auth.users
  SELECT id INTO existing_id FROM auth.users WHERE email = 'tanamao2026@outlook.com' LIMIT 1;

  IF existing_id IS NOT NULL THEN
    -- Se existir, usa o ID existente e atualiza a senha para garantir o acesso
    admin_uid := existing_id;
    
    UPDATE auth.users SET 
      encrypted_password = crypt('123456', gen_salt('bf')),
      raw_user_meta_data = '{"name":"Administrador","role":"admin"}',
      email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE id = admin_uid;
  ELSE
    -- Se não existir, cria o usuário na auth.users
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      role, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      admin_uid, '00000000-0000-0000-0000-000000000000', 'tanamao2026@outlook.com',
      crypt('123456', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{"name":"Administrador","role":"admin"}',
      now(), now(), 'authenticated', '', '', '', ''
    );
  END IF;

  -- 2. Garante que o perfil existe na public.users e tem a role 'admin'
  IF EXISTS (SELECT 1 FROM public.users WHERE id = admin_uid) THEN
    UPDATE public.users SET
      role = 'admin',
      is_active = true
    WHERE id = admin_uid;
  ELSIF EXISTS (SELECT 1 FROM public.users WHERE email = 'tanamao2026@outlook.com') THEN
    UPDATE public.users SET
      role = 'admin',
      is_active = true
    WHERE email = 'tanamao2026@outlook.com';
  ELSE
    INSERT INTO public.users (id, name, email, role, is_active, password_hash)
    VALUES (admin_uid, 'Administrador Global', 'tanamao2026@outlook.com', 'admin', true, 'supabase_auth');
  END IF;
END $$;
