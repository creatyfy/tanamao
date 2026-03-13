/*
  # Atualizar taxa padrão do app para 4%
  
  ## Query Description:
  Esta operação atualiza a coluna `commission_rate` da tabela `stores`.
  1. Define o valor padrão para 4% para novas lojas cadastradas no futuro.
  2. Atualiza todas as lojas existentes no banco de dados para a nova taxa de 4%.
  
  ## Metadata:
  - Schema-Category: "Data"
  - Impact-Level: "Medium"
  - Requires-Backup: false
  - Reversible: true
  
  ## Structure Details:
  - Tabela `stores`
  - Coluna `commission_rate`
*/

-- Atualiza o valor padrão para novos registros
ALTER TABLE public.stores ALTER COLUMN commission_rate SET DEFAULT 4;

-- Atualiza as lojas já existentes para 4%
UPDATE public.stores SET commission_rate = 4;
