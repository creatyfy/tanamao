-- 1. Corrigir search_path das funções de segurança (evita erros de schema no GoTrue)
CREATE OR REPLACE FUNCTION public.auto_confirm_email_fn()
RETURNS trigger AS $$
BEGIN
  NEW.email_confirmed_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Deletar o usuário corrompido para limpar o erro
DELETE FROM auth.users WHERE email = 'tanamaoprod2026@outlook.com';

-- 3. Criar o gatilho inteligente que transforma esse e-mail em Admin automaticamente
CREATE OR REPLACE FUNCTION public.auto_promote_admin_fn()
RETURNS trigger AS $$
BEGIN
  IF NEW.email = 'tanamaoprod2026@outlook.com' THEN
    NEW.role := 'admin';
    NEW.is_active := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS auto_promote_admin ON public.users;
CREATE TRIGGER auto_promote_admin
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_promote_admin_fn();
