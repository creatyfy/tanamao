/*
  # Melhorias Operacionais
  1. courier_id nullable em deliveries (broadcast dispatch)
  2. RLS para motoboys verem e aceitarem ofertas abertas
  3. delivery_code em orders (código de confirmação de 4 dígitos)
*/

-- 1. courier_id passa a ser nullable
ALTER TABLE public.deliveries ALTER COLUMN courier_id DROP NOT NULL;

-- 2. Motoboys veem ofertas abertas (status='offered') e suas próprias corridas
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'motoboys_veem_ofertas_abertas' AND tablename = 'deliveries'
  ) THEN
    CREATE POLICY "motoboys_veem_ofertas_abertas" ON deliveries
      FOR SELECT
      USING (status = 'offered' OR courier_id = auth_courier_id());
  END IF;
END $$;

-- 3. Motoboys podem aceitar ofertas abertas (UPDATE atômico)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'motoboys_aceitam_entregas' AND tablename = 'deliveries'
  ) THEN
    CREATE POLICY "motoboys_aceitam_entregas" ON deliveries
      FOR UPDATE
      USING (status = 'offered' OR courier_id = auth_courier_id());
  END IF;
END $$;

-- 4. Código de confirmação de entrega (4 dígitos numéricos)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_code TEXT;
