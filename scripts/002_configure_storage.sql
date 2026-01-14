-- =====================================================
-- CONFIGURAÇÃO DO STORAGE PARA TEST-PHOTOS
-- =====================================================
-- Este script configura o bucket "test-photos" como privado
-- e define as policies de RLS para controle de acesso

-- 1. Criar bucket "test-photos" como privado
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'test-photos',
  'test-photos',
  false, -- bucket privado
  10485760, -- 10MB por arquivo
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- 2. Habilitar RLS em storage.objects (se ainda não estiver habilitado)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Remover policies antigas do bucket test-photos (se existirem)
DROP POLICY IF EXISTS "Allow authenticated SELECT on test-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated INSERT on test-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated UPDATE on test-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated DELETE on test-photos" ON storage.objects;

-- 4. POLICY: SELECT - Permitir usuários autenticados lerem arquivos
CREATE POLICY "Allow authenticated SELECT on test-photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'test-photos');

-- 5. POLICY: INSERT - Permitir usuários autenticados fazerem upload
CREATE POLICY "Allow authenticated INSERT on test-photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'test-photos');

-- 6. POLICY: UPDATE - Permitir usuários autenticados atualizarem arquivos
-- Necessário porque o upload usa upsert:true
CREATE POLICY "Allow authenticated UPDATE on test-photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'test-photos')
WITH CHECK (bucket_id = 'test-photos');

-- 7. POLICY: DELETE - Permitir usuários autenticados deletarem arquivos
CREATE POLICY "Allow authenticated DELETE on test-photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'test-photos');

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
-- Para verificar se as policies foram criadas corretamente, execute:
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
--
-- Para verificar o bucket, execute:
-- SELECT * FROM storage.buckets WHERE id = 'test-photos';
