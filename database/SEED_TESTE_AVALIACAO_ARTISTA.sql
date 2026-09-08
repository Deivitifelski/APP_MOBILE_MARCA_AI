-- Avaliação de TESTE para o artista a2325f58-4381-4b02-954f-e96a0d3d727c
-- Rode no SQL Editor do Supabase (uma vez).

ALTER TABLE public.convite_participacao_evento
  ADD COLUMN IF NOT EXISTS show_confirmado BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.convite_participacao_evento
  ADD COLUMN IF NOT EXISTS show_confirmado_em TIMESTAMPTZ;

DO $$
DECLARE
  v_artista_avaliado UUID := 'a2325f58-4381-4b02-954f-e96a0d3d727c';
  v_artista_avaliador UUID;
  v_user_id UUID;
  v_evento_id UUID;
  v_convite_id UUID;
  v_avaliacao_id UUID;
  v_data_show DATE := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date - 3;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.artists WHERE id = v_artista_avaliado) THEN
    RAISE EXCEPTION 'Artista % não encontrado em public.artists.', v_artista_avaliado;
  END IF;

  -- Reutiliza convite aceito existente (show já passou)
  SELECT
    c.id,
    c.evento_origem_id,
    c.artista_que_convidou_id
  INTO v_convite_id, v_evento_id, v_artista_avaliador
  FROM public.convite_participacao_evento c
  WHERE c.artista_convidado_id = v_artista_avaliado
    AND c.status = 'aceito'
    AND c.data_evento < (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
  ORDER BY c.criado_em DESC
  LIMIT 1;

  IF v_convite_id IS NULL THEN
    -- Outro artista simula quem contratou
    SELECT a.id
    INTO v_artista_avaliador
    FROM public.artists a
    WHERE a.id <> v_artista_avaliado
    ORDER BY a.created_at DESC NULLS LAST
    LIMIT 1;

    IF v_artista_avaliador IS NULL THEN
      RAISE EXCEPTION 'Cadastre outro artista no app para simular quem contratou.';
    END IF;

    SELECT am.user_id
    INTO v_user_id
    FROM public.artist_members am
    WHERE am.artist_id = v_artista_avaliador
      AND am.user_id IS NOT NULL
    ORDER BY
      CASE am.role
        WHEN 'owner' THEN 0
        WHEN 'admin' THEN 1
        WHEN 'editor' THEN 2
        ELSE 3
      END
    LIMIT 1;

    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'O artista contratante precisa ter um membro com user_id em artist_members.';
    END IF;

    INSERT INTO public.events (
      artist_id,
      created_by,
      updated_by,
      name,
      description,
      event_date,
      start_time,
      end_time,
      value,
      city,
      state_uf,
      confirmed,
      tag,
      feed_tipo,
      ativo,
      created_at,
      updated_at
    ) VALUES (
      v_artista_avaliador,
      v_user_id,
      v_user_id,
      'Show teste · Avaliação Marca AI',
      'Evento fictício apenas para testar reputação no feed.',
      v_data_show,
      TIME '20:00',
      TIME '23:00',
      1800,
      'São Paulo',
      'SP',
      true,
      'evento',
      NULL,
      true,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_evento_id;

    INSERT INTO public.convite_participacao_evento (
      evento_origem_id,
      artista_que_convidou_id,
      artista_convidado_id,
      status,
      nome_evento,
      data_evento,
      hora_inicio,
      hora_fim,
      cache_valor,
      cidade,
      estado_uf,
      funcao_participacao,
      usuario_que_enviou_id,
      show_confirmado,
      show_confirmado_em,
      respondido_em,
      criado_em,
      atualizado_em
    ) VALUES (
      v_evento_id,
      v_artista_avaliador,
      v_artista_avaliado,
      'aceito',
      'Show teste · Avaliação Marca AI',
      v_data_show,
      TIME '20:00',
      TIME '23:00',
      1800,
      'São Paulo',
      'SP',
      'Vocalista',
      v_user_id,
      true,
      NOW(),
      NOW(),
      NOW(),
      NOW()
    )
    RETURNING id INTO v_convite_id;
  ELSE
    UPDATE public.convite_participacao_evento
    SET
      show_confirmado = true,
      show_confirmado_em = COALESCE(show_confirmado_em, NOW()),
      atualizado_em = NOW()
    WHERE id = v_convite_id;
  END IF;

  INSERT INTO public.participacao_evento_avaliacoes (
    convite_participacao_evento_id,
    evento_origem_id,
    artista_avaliador_id,
    artista_avaliado_id,
    nota_geral,
    nota_pontualidade,
    nota_profissionalismo,
    nota_qualidade_tecnica,
    nota_comunicacao,
    comentario_publico,
    observacao_privada
  ) VALUES (
    v_convite_id,
    v_evento_id,
    v_artista_avaliador,
    v_artista_avaliado,
    5,
    5,
    5,
    5,
    5,
    'Excelente profissional! Chegou no horário, comunicação impecável e entregou um show de altíssimo nível. Recomendo muito.',
    'Avaliação de teste inserida manualmente para validar reputação no feed.'
  )
  ON CONFLICT (convite_participacao_evento_id) DO UPDATE SET
    nota_geral = EXCLUDED.nota_geral,
    nota_pontualidade = EXCLUDED.nota_pontualidade,
    nota_profissionalismo = EXCLUDED.nota_profissionalismo,
    nota_qualidade_tecnica = EXCLUDED.nota_qualidade_tecnica,
    nota_comunicacao = EXCLUDED.nota_comunicacao,
    comentario_publico = EXCLUDED.comentario_publico,
    observacao_privada = EXCLUDED.observacao_privada,
    atualizado_em = NOW()
  RETURNING id INTO v_avaliacao_id;

  RAISE NOTICE 'OK — avaliação de teste: % | convite: % | evento: %', v_avaliacao_id, v_convite_id, v_evento_id;
END $$;

-- Confere reputação no feed
SELECT *
FROM public.rpc_app_resumo_reputacao_artistas(
  ARRAY['a2325f58-4381-4b02-954f-e96a0d3d727c']::uuid[]
);

-- Confere comentário público
SELECT
  a.nota_geral,
  a.comentario_publico,
  a.criado_em,
  av.name AS avaliador
FROM public.participacao_evento_avaliacoes a
LEFT JOIN public.artists av ON av.id = a.artista_avaliador_id
WHERE a.artista_avaliado_id = 'a2325f58-4381-4b02-954f-e96a0d3d727c'
ORDER BY a.criado_em DESC
LIMIT 5;
