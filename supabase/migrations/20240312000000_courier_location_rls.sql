/*
  # Permitir que clientes leiam a localização do motoboy do seu pedido ativo
  
  ## Query Description:
  Esta migração adiciona uma política de segurança (RLS) na tabela `couriers`.
  Ela permite que um usuário autenticado (cliente) possa fazer SELECT na tabela
  de motoboys APENAS SE existir um pedido ativo (`status = 'delivering'`)
  vinculado ao seu `client_id` e ao `courier_id` em questão.
  
  ## Metadata:
  - Schema-Category: "Security"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true
  
  ## Security Implications:
  - RLS Status: Enabled
  - Policy Changes: Yes (Nova política em `couriers`)
  - Auth Requirements: Autenticação obrigatória (auth.uid())
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'clientes_veem_localizacao_motoboy' 
    AND tablename = 'couriers'
  ) THEN
    CREATE POLICY "clientes_veem_localizacao_motoboy" ON couriers
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM orders o
          WHERE o.courier_id = couriers.id
          AND o.client_id = auth.uid()
          AND o.status IN ('delivering')
        )
      );
  END IF;
END $$;
