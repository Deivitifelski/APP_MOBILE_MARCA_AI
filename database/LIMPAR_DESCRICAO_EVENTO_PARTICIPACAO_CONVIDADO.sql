-- Opcional: remove texto copiado indevidamente na agenda do convidado (observações do evento do organizador).
-- Após rodar, a mensagem do convite continua em convite_participacao_evento.mensagem (detalhes do evento lê dali).
-- Execute só se quiser limpar dados antigos antes da correção em rpc_aceitar_convite_participacao_evento.

UPDATE public.events e
SET description = NULL,
    updated_at = NOW()
WHERE e.convite_participacao_id IS NOT NULL
  AND e.description IS NOT NULL;
