/*
  # Fix State Column and Create Admin

  ## Query Description:
  Altera a coluna `state` na tabela `addresses` para `VARCHAR(2)` para garantir que ela aceite as siglas dos estados sem erros de tipagem restrita.
  Cria o usuário Administrador padrão de forma segura diretamente no banco de dados, sem depender do frontend.

  ## Metadata:
  - Schema-Category: "Data"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true

  ## Structure Details:
  - Altera `public.addresses.state` para `VARCHAR(2)`.
  - Insere o admin na tabela `auth.users`.
  - Insere o perfil do admin na tabela `public.users`.
*/

-- 1. Garante que a coluna state aceite 2 caracteres de forma flexível
ALTER TABLE public.addresses ALTER COLUMN state TYPE VARCHAR(2);

-- 2. Cria o usuário no sistema de autenticação do Supabase (Se não existir)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'tanamao2026@outlook.com',
  crypt('123456', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Administrador","role":"admin"}',
  now(),
  now(),
  'authenticated',
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- 3. Insere o perfil do Admin na tabela pública de usuários
INSERT INTO public.users (
  id,
  name,
  email,
  role,
  is_active,
  password_hash
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Administrador Global',
  'tanamao2026@outlook.com',
  'admin',
  true,
  'supabase_auth'
) ON CONFLICT (id) DO NOTHING;
