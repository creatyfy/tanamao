/*
  # Entrega Propria
  Adiciona suporte a entrega propria da loja.

  ## Query Description:
  Adiciona a coluna own_delivery na tabela orders para permitir que a loja gerencie a entrega sem acionar motoboys da plataforma.
  
  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true
  
  ## Structure Details:
  - Tabela `orders` ganha coluna `own_delivery` (BOOLEAN DEFAULT false)
  
  ## Security Implications:
  - RLS Status: Enabled
  - Policy Changes: No
  - Auth Requirements: None
  
  ## Performance Impact:
  - Indexes: None
  - Triggers: None
  - Estimated Impact: Low
*/

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS own_delivery BOOLEAN NOT NULL DEFAULT false;
