-- Bucket `press_kit` + políticas RLS em storage.objects.
-- Caminho no app: `{user_id}/press_kit/{artist_id}/arquivo.ext` (1º segmento = JWT sub; pasta `press_kit` só organiza no painel).
--
-- Se o upload falhar com "row-level security" / "new row violates policy":
-- 1) Rode este script inteiro no SQL Editor (as policies são recriadas).
-- 2) Confirme que o app está com sessão logada (usuário autenticado) ao enviar.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'press_kit',
  'press_kit',
  true,
  52428800,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

-- Leitura pública (URL pública do objeto).
DROP POLICY IF EXISTS "press_kit_public_read" ON storage.objects;
CREATE POLICY "press_kit_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'press_kit');

-- Upload: pasta raiz do objeto = id do usuário no JWT (recomendado pela documentação Supabase).
DROP POLICY IF EXISTS "press_kit_insert_own_prefix" ON storage.objects;
CREATE POLICY "press_kit_insert_own_prefix"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'press_kit'
    AND (storage.foldername(name))[1] = (SELECT (auth.jwt() ->> 'sub'))
  );

DROP POLICY IF EXISTS "press_kit_update_own_prefix" ON storage.objects;
CREATE POLICY "press_kit_update_own_prefix"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'press_kit'
    AND (storage.foldername(name))[1] = (SELECT (auth.jwt() ->> 'sub'))
  )
  WITH CHECK (
    bucket_id = 'press_kit'
    AND (storage.foldername(name))[1] = (SELECT (auth.jwt() ->> 'sub'))
  );

DROP POLICY IF EXISTS "press_kit_delete_own_prefix" ON storage.objects;
CREATE POLICY "press_kit_delete_own_prefix"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'press_kit'
    AND (storage.foldername(name))[1] = (SELECT (auth.jwt() ->> 'sub'))
  );
