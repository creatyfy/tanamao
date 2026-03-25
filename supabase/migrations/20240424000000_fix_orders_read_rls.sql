/*
  # Fix Orders Read Policy for Couriers
  Permite que motoboys leiam os dados dos pedidos para receberem as ofertas de entrega.

  ## Query Description:
  Esta operação atualiza a política de Row Level Security (RLS) na tabela `orders`. Ela permite que motoboys autenticados leiam os detalhes do pedido mesmo antes de aceitarem a corrida. Isso é estritamente necessário para que o app do motoboy consiga exibir o nome da loja, endereço e valor do ganho quando uma nova entrega é oferecida no painel.
  
  ## Metadata:
  - Schema-Category: "Security"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true
  
  ## Structure Details:
  - Table: `orders`
  - Policy: `Enable read access for involved parties`
  
  ## Security Implications:
  - RLS Status: Enabled
  - Policy Changes: Yes (Política de SELECT expandida para incluir todos os motoboys)
  - Auth Requirements: Precisa estar autenticado e ter a role 'courier'
  
  ## Performance Impact:
  - Indexes: None
  - Triggers: None
  - Estimated Impact: Negligível
*/

DROP POLICY IF EXISTS "Enable read access for involved parties" ON orders;

CREATE POLICY "Enable read access for involved parties" ON orders FOR SELECT USING (
  auth.uid() = client_id OR
  auth.uid() IN (SELECT owner_id FROM stores WHERE id = store_id) OR
  auth.uid() IN (SELECT user_id FROM couriers WHERE id = courier_id) OR
  (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'courier')) OR
  is_admin()
);
