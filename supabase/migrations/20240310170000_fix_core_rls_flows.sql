/*
# Fix RLS Policies for Core Workflows
Esta migração resolve erros ocultos de permissão que estavam bloqueando os fluxos principais:
1. Lojas não conseguiam ver motoboys online para despachar pedidos.
2. Motoboys não conseguiam aceitar pedidos pois não tinham permissão de update.
3. Clientes não conseguiam finalizar checkout por falta de permissão na tabela payments.

## Metadata:
- Schema-Category: "Security"
- Impact-Level: "Medium"
- Requires-Backup: false
- Reversible: true
*/

DO $$ 
BEGIN
    -- 1. Lojas veem motoboys online (Necessário para despachar pedidos)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'lojas_veem_motoboys_online' AND tablename = 'couriers') THEN
        CREATE POLICY "lojas_veem_motoboys_online" ON couriers FOR SELECT USING (is_online = true);
    END IF;

    -- 2. Lojas criam entregas (Garante que a loja pode criar o convite para o motoboy)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'lojas_criam_entregas' AND tablename = 'deliveries') THEN
        CREATE POLICY "lojas_criam_entregas" ON deliveries FOR INSERT WITH CHECK (
            EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.store_id = auth_store_id())
        );
    END IF;

    -- 3. Motoboys atualizam pedidos (Necessário para o motoboy aceitar a corrida e colocar seu ID no pedido)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'motoboys_atualizam_pedidos_atribuidos' AND tablename = 'orders') THEN
        CREATE POLICY "motoboys_atualizam_pedidos_atribuidos" ON orders FOR UPDATE USING (
            EXISTS (SELECT 1 FROM deliveries d WHERE d.order_id = id AND d.courier_id = auth_courier_id())
        );
    END IF;

    -- 4. Clientes criam pagamentos (Necessário para finalizar o checkout)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'clientes_criam_pagamentos' AND tablename = 'payments') THEN
        CREATE POLICY "clientes_criam_pagamentos" ON payments FOR INSERT WITH CHECK (
            EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.client_id = auth.uid())
        );
    END IF;
END $$;
