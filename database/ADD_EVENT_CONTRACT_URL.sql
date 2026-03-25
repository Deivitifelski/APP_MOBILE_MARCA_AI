-- Anexo de contrato no evento (URL pública no Supabase Storage, bucket event_contracts)
ALTER TABLE events ADD COLUMN IF NOT EXISTS contract_url TEXT;

COMMENT ON COLUMN events.contract_url IS 'URL pública do arquivo de contrato (PDF/imagem) no Storage';

-- No Supabase Dashboard > Storage: criar bucket público "event_contracts"
-- Políticas sugeridas (ajuste conforme seu RLS):
-- - INSERT/UPDATE/DELETE: usuários autenticados
-- - SELECT: público (se bucket for público) ou autenticado
