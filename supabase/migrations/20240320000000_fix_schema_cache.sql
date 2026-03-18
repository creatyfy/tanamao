/*
  # Fix Schema Cache for delivery_code
  
  ## Query Description:
  Garante que a coluna delivery_code existe e força a API do Supabase (PostgREST) a recarregar o cache do schema para evitar erros no checkout.
  
  ## Metadata:
  - Schema-Category: "Safe"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true
*/

-- Garante que a coluna existe (caso a migration anterior tenha falhado por algum motivo)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_code TEXT;

-- Comando mágico que avisa a API do Supabase para limpar o cache e ler as colunas novas
NOTIFY pgrst, 'reload schema';
