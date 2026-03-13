/*
  # Auto Confirm Email Trigger
  Automaticamente confirma os e-mails de novos usuários para burlar a exigência de confirmação durante os testes.

  ## Query Description:
  Esta operação cria uma trigger na tabela auth.users que define a coluna email_confirmed_at com o timestamp atual no momento da criação do usuário. Isso permite que as contas de teste façam login imediatamente.
  
  ## Metadata:
  - Schema-Category: "Safe"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true
  
  ## Structure Details:
  - Função: public.auto_confirm_email_fn()
  - Trigger: auto_confirm_email na tabela auth.users
  
  ## Security Implications:
  - RLS Status: N/A
  - Policy Changes: Nenhuma
  - Auth Requirements: Nenhuma
  
  ## Performance Impact:
  - Indexes: Nenhum
  - Triggers: Adicionada auto_confirm_email
  - Estimated Impact: Nenhum
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
