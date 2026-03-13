-- Campo de troco para pedidos em dinheiro
ALTER TABLE orders ADD COLUMN IF NOT EXISTS change_for NUMERIC(10,2) DEFAULT NULL;

-- Garantir que a coluna payment_method existe (caso não exista)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash';

-- Garantir que payment_method aceita 'cash' como padrão
ALTER TABLE orders ALTER COLUMN payment_method SET DEFAULT 'cash';
