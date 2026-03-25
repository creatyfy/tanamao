/*
  # Fix Orders RLS for Couriers
  Permite que motoboys leiam pedidos que ainda não foram atribuídos a ninguém (courier_id IS NULL),
  para que possam receber os dados da loja e do cliente na tela de "Nova Corrida".

  ## Query Description:
  Atualiza a política de SELECT na tabela `orders` para incluir a permissão de leitura para motoboys em pedidos pendentes.
  
  ## Metadata:
  - Schema-Category: "Security"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true
*/

DROP POLICY IF EXISTS "Enable read access for involved parties" ON orders;

CREATE POLICY "Enable read access for involved parties" ON orders
FOR SELECT
USING (
  (auth.uid() = client_id) OR 
  (auth.uid() IN (SELECT owner_id FROM stores WHERE id = store_id)) OR 
  (auth.uid() IN (SELECT user_id FROM couriers WHERE id = courier_id)) OR 
  (courier_id IS NULL AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'courier')) OR
  is_admin()
);
