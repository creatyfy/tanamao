/*
  # Fix Deliveries RLS for Store Auto-Dispatch
  Adiciona uma política permitindo que as lojas criem entregas para seus próprios pedidos.

  ## Query Description:
  Esta operação adiciona uma política de INSERT na tabela `deliveries`. Ela permite que o dono de uma loja crie um registro de entrega, o que é estritamente necessário para a funcionalidade de auto-despacho quando um pedido é marcado como 'Pronto'.
  
  ## Metadata:
  - Schema-Category: "Security"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true
  
  ## Structure Details:
  - Table: `deliveries`
  - Policy: "loja cria entrega" (INSERT)
*/

CREATE POLICY "loja cria entrega" ON deliveries FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_id AND orders.store_id = auth_store_id())
);
