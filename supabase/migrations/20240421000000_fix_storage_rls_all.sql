-- Inicia a transação
BEGIN;

-- 1. Garante que os buckets existem e são públicos
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('products', 'products', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('stores', 'stores', true) ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Remove políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Insert Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Access" ON storage.objects;
DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;

-- 3. Cria as políticas definitivas e corretas
-- Permite que qualquer pessoa veja as imagens (necessário para o app do cliente)
CREATE POLICY "Public Read Access" 
ON storage.objects FOR SELECT 
USING (bucket_id IN ('avatars', 'products', 'stores'));

-- Permite que usuários logados façam upload de novas imagens
CREATE POLICY "Authenticated Insert Access" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id IN ('avatars', 'products', 'stores'));

-- Permite que usuários logados atualizem imagens
CREATE POLICY "Authenticated Update Access" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id IN ('avatars', 'products', 'stores'));

-- Permite que usuários logados deletem imagens
CREATE POLICY "Authenticated Delete Access" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id IN ('avatars', 'products', 'stores'));

COMMIT;
