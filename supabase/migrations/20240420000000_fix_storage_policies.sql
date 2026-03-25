-- Corrige as políticas de segurança do Storage para permitir uploads

-- Garante que os buckets existem e são públicos
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('products', 'products', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('stores', 'stores', true) ON CONFLICT (id) DO NOTHING;

-- Remove a política antiga genérica que estava incompleta
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- 1. Permite que qualquer pessoa VEJA as imagens (Leitura)
CREATE POLICY "Public Read Access" 
ON storage.objects FOR SELECT 
USING (bucket_id IN ('avatars', 'products', 'stores'));

-- 2. Permite que usuários logados FAÇAM UPLOAD de imagens (Escrita)
CREATE POLICY "Authenticated Insert Access" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id IN ('avatars', 'products', 'stores'));

-- 3. Permite que usuários logados ATUALIZEM imagens
CREATE POLICY "Authenticated Update Access" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id IN ('avatars', 'products', 'stores'));

-- 4. Permite que usuários logados DELETEM imagens
CREATE POLICY "Authenticated Delete Access" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id IN ('avatars', 'products', 'stores'));
