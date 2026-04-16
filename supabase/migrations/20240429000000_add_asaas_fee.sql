/*
# Adicionar coluna asaas_fee na tabela payments
Adiciona a coluna para registrar a taxa descontada pelo Asaas em cada transação.

## Query Description: 
Esta operação adiciona uma nova coluna numérica `asaas_fee` à tabela `payments` com valor padrão 0. Não afeta os dados existentes, apenas permite o registro das taxas futuras.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true

## Structure Details:
- Tabela `payments`: Adicionada coluna `asaas_fee` (NUMERIC(10,2), default 0)

## Security Implications:
- RLS Status: Não alterado
- Policy Changes: Nenhuma
- Auth Requirements: Nenhuma

## Performance Impact:
- Indexes: Nenhum
- Triggers: Nenhum
- Estimated Impact: Nenhum impacto de performance esperado
*/

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS asaas_fee NUMERIC(10,2) DEFAULT 0;
