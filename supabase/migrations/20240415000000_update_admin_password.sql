/*
# Update Admin User Credentials
Updates the password for the main admin account or creates it if it doesn't exist.

## Query Description:
This operation modifies the auth.users and public.users tables to ensure the admin account (tanamaoprod2026@outlook.com) exists and has the requested password (Pocinhos123).

## Metadata:
- Schema-Category: Data
- Impact-Level: Low
- Requires-Backup: false
- Reversible: true

## Structure Details:
Affects auth.users (password update) and public.users (role enforcement).

## Security Implications:
- RLS Status: Bypassed (runs as superuser during migration)
- Policy Changes: None
- Auth Requirements: None

## Performance Impact:
- Indexes: None
- Triggers: None
- Estimated Impact: Negligible
*/

DO $$
DECLARE
  admin_uid UUID;
BEGIN
  -- Verifica se o usuário já existe na tabela de autenticação
  SELECT id INTO admin_uid FROM auth.users WHERE email = 'tanamaoprod2026@outlook.com';

  IF admin_uid IS NULL THEN
    -- Se não existir, cria um novo usuário
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
      crypt('Pocinhos123', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Admin Master"}',
      false
    );
  ELSE
    -- Se já existir, atualiza a senha para a nova solicitada
    UPDATE auth.users
    SET encrypted_password = crypt('Pocinhos123', gen_salt('bf')),
        updated_at = now()
    WHERE id = admin_uid;
  END IF;

  -- Garante que o perfil público exista e tenha a role 'admin' e status ativo
  INSERT INTO public.users (id, name, email, role, is_active, created_at)
  VALUES (admin_uid, 'Admin Master', 'tanamaoprod2026@outlook.com', 'admin', true, now())
  ON CONFLICT (id) DO UPDATE SET 
    role = 'admin', 
    is_active = true;
    
END $$;
