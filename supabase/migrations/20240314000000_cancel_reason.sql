-- Adiciona a coluna para armazenar o motivo do cancelamento
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT DEFAULT NULL;
