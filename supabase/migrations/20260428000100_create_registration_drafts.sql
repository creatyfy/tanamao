/*
  # Create registration_drafts table

  ## Query Description:
  Cria a tabela de rascunhos de cadastro usada no fluxo de confirmação de e-mail
  para lojas e motoboys. Sem essa tabela, dados críticos do formulário se perdem
  entre o signUp e a finalização do cadastro.

  ## Metadata:
  - Schema-Category: Structural
  - Impact-Level: Medium
  - Requires-Backup: false
  - Reversible: true
*/

CREATE TABLE IF NOT EXISTS public.registration_drafts (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('store_owner', 'courier')),
  draft JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE OR REPLACE FUNCTION public.touch_registration_drafts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_registration_drafts_updated_at ON public.registration_drafts;
CREATE TRIGGER trg_registration_drafts_updated_at
BEFORE UPDATE ON public.registration_drafts
FOR EACH ROW
EXECUTE FUNCTION public.touch_registration_drafts_updated_at();

ALTER TABLE public.registration_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "registration_drafts_select_own" ON public.registration_drafts;
CREATE POLICY "registration_drafts_select_own"
ON public.registration_drafts
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "registration_drafts_insert_own" ON public.registration_drafts;
CREATE POLICY "registration_drafts_insert_own"
ON public.registration_drafts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "registration_drafts_update_own" ON public.registration_drafts;
CREATE POLICY "registration_drafts_update_own"
ON public.registration_drafts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "registration_drafts_delete_own" ON public.registration_drafts;
CREATE POLICY "registration_drafts_delete_own"
ON public.registration_drafts
FOR DELETE
USING (auth.uid() = user_id OR public.is_admin());
