-- Coluna grupo_disputa_id + índice (idempotente). Depois rode FUNCOES_CONVITE_PARTICIPACAO_EVENTO_RPC.sql atualizado.

ALTER TABLE public.convite_participacao_evento
  ADD COLUMN IF NOT EXISTS grupo_disputa_id UUID;

UPDATE public.convite_participacao_evento
SET grupo_disputa_id = gen_random_uuid()
WHERE grupo_disputa_id IS NULL;

ALTER TABLE public.convite_participacao_evento
  ALTER COLUMN grupo_disputa_id SET NOT NULL;

ALTER TABLE public.convite_participacao_evento
  ALTER COLUMN grupo_disputa_id SET DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS idx_convite_part_grupo_pendente
  ON public.convite_participacao_evento (grupo_disputa_id)
  WHERE status = 'pendente';
