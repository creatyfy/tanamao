/*
  # Configuração do Storage para Imagens de Produtos

  ## Query Description:
  Cria o bucket 'products' no Supabase Storage para armazenar as fotos dos itens do cardápio das lojas.
  Configura as políticas de segurança (RLS) para permitir que qualquer pessoa veja as imagens, mas apenas usuários autenticados (lojas) possam fazer upload, atualizar ou deletar.
  
  ## Metadata:
  - Schema-Category: "Safe"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true
  
  ## Security Implications:
  - RLS Status: Enabled on storage.objects
  - Policy Changes: Added SELECT (public), INSERT, UPDATE, DELETE (authenticated)
*/

-- Criar o bucket 'products' se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Permitir acesso público de leitura às imagens dos produtos
CREATE POLICY "Imagens de produtos são públicas"
ON storage.objects FOR SELECT
USING (bucket_id = 'products');

-- Permitir que usuários autenticados façam upload de imagens
CREATE POLICY "Lojas podem fazer upload de imagens"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'products' AND
  auth.role() = 'authenticated'
);

-- Permitir que usuários autenticados atualizem suas imagens
CREATE POLICY "Lojas podem atualizar suas imagens"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'products' AND
  auth.role() = 'authenticated'
);

-- Permitir que usuários autenticados deletem suas imagens
CREATE POLICY "Lojas podem deletar suas imagens"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'products' AND
  auth.role() = 'authenticated'
);
