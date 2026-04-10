-- Coluna opcional de UF do evento (2 letras). Rode no SQL Editor do Supabase.
-- Cidade continua em `city`; estado em `state_uf` para rankings e filtros sem depender do texto.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS state_uf TEXT;

COMMENT ON COLUMN public.events.state_uf IS 'Sigla da UF brasileira (ex.: SP, RJ). Opcional; complementa city.';

-- A agenda usa get_events_by_role; o script database/RPC_RESTORE_GET_EVENTS_ORIGINAL.sql já retorna state_uf.
