-- Adiciona a coluna cpf na tabela users para armazenar o CPF de clientes
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cpf TEXT;
