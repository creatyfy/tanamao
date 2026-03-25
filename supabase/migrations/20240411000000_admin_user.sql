/*
  # Criação do Usuário Admin
  Cria o usuário administrador principal do sistema.

  ## Query Description:
  Esta operação insere um usuário na tabela auth.users e na tabela public.users com a role 'admin', garantindo que o sistema tenha um administrador inicial para gerenciar a plataforma.

  ## Metadata:
  - Schema-Category: "Data"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true
*/

DO $$
DECLARE
  admin_uid UUID;
BEGIN
  SELECT id INTO admin_uid FROM auth.users WHERE email = 'tanamaoprod2026@outlook.com';

  IF admin_uid IS NULL THEN
    admin_uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin
    ) VALUES (
      admin_uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'tanamaoprod2026@outlook.com',
      crypt('Pocinhos2026#', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Admin Master"}',
      false
    );
  END IF;

  INSERT INTO public.users (id, name, email, role, is_active, created_at)
  VALUES (admin_uid, 'Admin Master', 'tanamaoprod2026@outlook.com', 'admin', true, now())
  ON CONFLICT (id) DO UPDATE SET role = 'admin', is_active = true;
END $$;
