/*
  # Correção de Permissões (RLS) para Operação da Loja
  Resolve o erro 403 (Forbidden) ao aceitar/recusar pedidos e chamar motoboy.

  ## Query Description:
  Esta migração corrige três políticas de segurança essenciais:
  1. Permite que o gatilho (trigger) do banco de dados insira o histórico de status quando a loja atualiza um pedido.
  2. Permite que a loja crie um registro na tabela de entregas (deliveries) ao clicar em "Chamar Motoboy".
  3. Reforça a política de atualização de pedidos para garantir que a loja só altere seus próprios pedidos.
  
  ## Metadata:
  - Schema-Category: "Security"
  - Impact-Level: "Medium"
  - Requires-Backup: false
  - Reversible: true
*/

BEGIN;

-- 1. Permitir inserção no histórico de status (necessário para o trigger funcionar)
DROP POLICY IF EXISTS "status_history: permite inserção" ON public.order_status_history;
CREATE POLICY "status_history: permite inserção"
ON public.order_status_history
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 2. Permitir que a loja crie uma oferta de entrega (necessário para "Chamar Motoboy")
DROP POLICY IF EXISTS "deliveries: loja cria" ON public.deliveries;
CREATE POLICY "deliveries: loja cria"
ON public.deliveries
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_id
    AND orders.store_id = (SELECT id FROM public.stores WHERE owner_id = auth.uid() LIMIT 1)
  )
);

-- 3. Reforçar a política de atualização de pedidos pela loja
DROP POLICY IF EXISTS "orders: loja atualiza status" ON public.orders;
CREATE POLICY "orders: loja atualiza status"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = orders.store_id
    AND stores.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = orders.store_id
    AND stores.owner_id = auth.uid()
  )
);

COMMIT;
