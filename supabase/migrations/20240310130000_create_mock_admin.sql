-- Habilita a extensão de criptografia caso não esteja ativa
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  admin_uid UUID := '99999999-9999-9999-9999-999999999999'::UUID;
BEGIN
  -- Verifica se o admin já existe para não duplicar
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@tanamao.app') THEN
    
    -- 1. Insere o usuário diretamente na tabela de autenticação do Supabase (já confirmado)
    INSERT INTO auth.users (
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud
    ) VALUES (
      admin_uid,
      'admin@tanamao.app',
      extensions.crypt('123456', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Admin Master","role":"admin"}',
      now(),
      now(),
      'authenticated',
      'authenticated'
    );

    -- 2. Insere o perfil do admin na sua tabela pública
    INSERT INTO public.users (
      id, 
      name, 
      email, 
      role, 
      is_active, 
      password_hash
    ) VALUES (
      admin_uid, 
      'Admin Master', 
      'admin@tanamao.app', 
      'admin', 
      true, 
      'supabase_auth'
    );
    
  END IF;
END $$;
