/*
  # Configuração de Auto Confirmação de Email
  Cria uma trigger para confirmar automaticamente os emails dos novos usuários registrados.

  ## Query Description:
  Esta operação adiciona uma função e uma trigger na tabela auth.users para preencher automaticamente o campo email_confirmed_at. Isso permite que os usuários façam login imediatamente após o registro sem precisar confirmar o email.

  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true

  ## Structure Details:
  - Function: public.auto_confirm_email_fn()
  - Trigger: auto_confirm_email on auth.users
*/

CREATE OR REPLACE FUNCTION public.auto_confirm_email_fn()
RETURNS trigger AS $$
BEGIN
  NEW.email_confirmed_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_confirm_email ON auth.users;
CREATE TRIGGER auto_confirm_email
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_confirm_email_fn();
