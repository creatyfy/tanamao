/*
  # Add birth_date to stores and couriers

  ## Query Description:
  Adiciona a coluna birth_date usada no frontend para persistir data de nascimento
  de cadastro com CPF (lojas pessoa física e motoboys).

  ## Metadata:
  - Schema-Category: Structural
  - Impact-Level: Low
  - Requires-Backup: false
  - Reversible: true
*/

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS birth_date DATE;

ALTER TABLE public.couriers
  ADD COLUMN IF NOT EXISTS birth_date DATE;
