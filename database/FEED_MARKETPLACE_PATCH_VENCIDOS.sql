-- Patch: anúncios vencidos saem do feed automaticamente.
-- Rode no SQL Editor do Supabase (após FEED_MARKETPLACE.sql).

CREATE OR REPLACE FUNCTION public.feed_data_hoje_brasil()
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
$$;

CREATE OR REPLACE FUNCTION public.encerrar_anuncios_feed_vencidos()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje DATE := public.feed_data_hoje_brasil();
  v_count INTEGER := 0;
BEGIN
  UPDATE public.convite_participacao_evento c
  SET
    status = 'cancelado',
    motivo_cancelamento = 'Anúncio encerrado automaticamente: data do show já passou.',
    respondido_em = NOW(),
    atualizado_em = NOW()
  FROM public.events e
  WHERE COALESCE(e.ativo, true) = true
    AND e.feed_tipo IS NOT NULL
    AND e.feed_tipo IN ('disponivel', 'demanda')
    AND e.event_date < v_hoje
    AND (
      c.grupo_disputa_id = e.id
      OR c.evento_origem_id = e.id
    )
    AND c.status = 'pendente';

  UPDATE public.events
  SET
    ativo = false,
    update_ativo = NOW(),
    updated_at = NOW()
  WHERE COALESCE(ativo, true) = true
    AND feed_tipo IS NOT NULL
    AND feed_tipo IN ('disponivel', 'demanda')
    AND event_date < v_hoje;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.encerrar_anuncios_feed_vencidos() TO authenticated;

-- Encerra agora os que já venceram
SELECT public.encerrar_anuncios_feed_vencidos() AS anuncios_encerrados_agora;

-- IMPORTANTE: depois rode novamente o bloco listar_feed_marketplace
-- e listar_propostas_feed_marketplace do arquivo FEED_MARKETPLACE.sql
-- (versão com feed_data_hoje_brasil + PERFORM encerrar_anuncios_feed_vencidos).
