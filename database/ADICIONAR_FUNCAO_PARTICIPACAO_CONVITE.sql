-- Adiciona função do participante no convite de participação em evento
-- Exemplo de uso: Violão, Voz, Percussão

ALTER TABLE convite_participacao_evento
  ADD COLUMN IF NOT EXISTS funcao_participacao TEXT;

ALTER TABLE convite_participacao_evento
  ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;
