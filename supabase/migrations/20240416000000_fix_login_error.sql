-- 1. Corrige o search_path nas funções para evitar erros de permissão de schema
CREATE OR REPLACE FUNCTION public.auto_confirm_email_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.email_confirmed_at = COALESCE(NEW.email_confirmed_at, now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- 2. Cria o registro de identidade obrigatório para o usuário Admin criado via SQL
DO $$
DECLARE
  admin_uid UUID;
BEGIN
  SELECT id INTO admin_uid FROM auth.users WHERE email = 'tanamaoprod2026@outlook.com';

  IF admin_uid IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = admin_uid) THEN
      BEGIN
        INSERT INTO auth.identities (
          id, user_id, provider_id, identity_data, provider, created_at, updated_at
        ) VALUES (
          gen_random_uuid()::text,
          admin_uid,
          admin_uid::text,
          format('{"sub":"%s","email":"%s"}', admin_uid::text, 'tanamaoprod2026@outlook.com')::jsonb,
          'email',
          now(),
          now()
        );
      EXCEPTION WHEN OTHERS THEN
        -- Fallback caso a versão do Supabase seja mais antiga e não tenha a coluna provider_id
        INSERT INTO auth.identities (
          id, user_id, identity_data, provider, created_at, updated_at
        ) VALUES (
          gen_random_uuid()::text,
          admin_uid,
          format('{"sub":"%s","email":"%s"}', admin_uid::text, 'tanamaoprod2026@outlook.com')::jsonb,
          'email',
          now(),
          now()
        );
      END;
    END IF;
  END IF;
END $$;
