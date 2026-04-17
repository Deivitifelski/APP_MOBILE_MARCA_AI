-- Avaliação de artista convidado após evento concluído.
-- Regra de elegibilidade: somente convites aceitos e com data_evento < CURRENT_DATE (D+1).

CREATE TABLE IF NOT EXISTS public.participacao_evento_avaliacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convite_participacao_evento_id UUID NOT NULL UNIQUE
    REFERENCES public.convite_participacao_evento(id) ON DELETE CASCADE,
  evento_origem_id UUID NOT NULL
    REFERENCES public.events(id) ON DELETE CASCADE,
  artista_avaliador_id UUID NOT NULL
    REFERENCES public.artists(id) ON DELETE CASCADE,
  artista_avaliado_id UUID NOT NULL
    REFERENCES public.artists(id) ON DELETE CASCADE,
  nota_geral SMALLINT NOT NULL CHECK (nota_geral BETWEEN 1 AND 5),
  nota_pontualidade SMALLINT CHECK (nota_pontualidade BETWEEN 1 AND 5),
  nota_profissionalismo SMALLINT CHECK (nota_profissionalismo BETWEEN 1 AND 5),
  nota_qualidade_tecnica SMALLINT CHECK (nota_qualidade_tecnica BETWEEN 1 AND 5),
  nota_comunicacao SMALLINT CHECK (nota_comunicacao BETWEEN 1 AND 5),
  comentario_publico TEXT,
  observacao_privada TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT participacao_avaliacao_artistas_distintos
    CHECK (artista_avaliador_id <> artista_avaliado_id)
);

CREATE INDEX IF NOT EXISTS idx_participacao_avaliacao_evento_origem
  ON public.participacao_evento_avaliacoes (evento_origem_id);

CREATE INDEX IF NOT EXISTS idx_participacao_avaliacao_artista_avaliado
  ON public.participacao_evento_avaliacoes (artista_avaliado_id);

CREATE OR REPLACE FUNCTION public.trg_participacao_evento_avaliacoes_set_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_participacao_evento_avaliacoes_atualizado_em
  ON public.participacao_evento_avaliacoes;

CREATE TRIGGER trg_participacao_evento_avaliacoes_atualizado_em
  BEFORE UPDATE ON public.participacao_evento_avaliacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_participacao_evento_avaliacoes_set_atualizado_em();

ALTER TABLE public.participacao_evento_avaliacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS participacao_avaliacao_select ON public.participacao_evento_avaliacoes;
DROP POLICY IF EXISTS participacao_avaliacao_insert ON public.participacao_evento_avaliacoes;
DROP POLICY IF EXISTS participacao_avaliacao_update ON public.participacao_evento_avaliacoes;
DROP POLICY IF EXISTS participacao_avaliacao_delete ON public.participacao_evento_avaliacoes;

CREATE POLICY participacao_avaliacao_select ON public.participacao_evento_avaliacoes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.artist_members am
      WHERE am.artist_id = participacao_evento_avaliacoes.artista_avaliador_id
        AND am.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.artist_members am
      WHERE am.artist_id = participacao_evento_avaliacoes.artista_avaliado_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY participacao_avaliacao_insert ON public.participacao_evento_avaliacoes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.artist_members am
      WHERE am.artist_id = participacao_evento_avaliacoes.artista_avaliador_id
        AND am.user_id = auth.uid()
        AND am.role IN ('editor', 'admin', 'owner')
    )
  );

CREATE POLICY participacao_avaliacao_update ON public.participacao_evento_avaliacoes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.artist_members am
      WHERE am.artist_id = participacao_evento_avaliacoes.artista_avaliador_id
        AND am.user_id = auth.uid()
        AND am.role IN ('editor', 'admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.artist_members am
      WHERE am.artist_id = participacao_evento_avaliacoes.artista_avaliador_id
        AND am.user_id = auth.uid()
        AND am.role IN ('editor', 'admin', 'owner')
    )
  );

-- Sem delete físico via app.
CREATE POLICY participacao_avaliacao_delete ON public.participacao_evento_avaliacoes
  FOR DELETE
  USING (false);

CREATE OR REPLACE FUNCTION public.rpc_app_salvar_avaliacao_participacao_evento(
  p_convite_id UUID,
  p_nota_geral SMALLINT,
  p_nota_pontualidade SMALLINT DEFAULT NULL,
  p_nota_profissionalismo SMALLINT DEFAULT NULL,
  p_nota_qualidade_tecnica SMALLINT DEFAULT NULL,
  p_nota_comunicacao SMALLINT DEFAULT NULL,
  p_comentario_publico TEXT DEFAULT NULL,
  p_observacao_privada TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error TEXT,
  avaliacao_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_convite public.convite_participacao_evento%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'Usuário não autenticado.', NULL::UUID;
    RETURN;
  END IF;

  IF p_nota_geral IS NULL OR p_nota_geral < 1 OR p_nota_geral > 5 THEN
    RETURN QUERY SELECT false, 'A nota geral deve estar entre 1 e 5.', NULL::UUID;
    RETURN;
  END IF;

  SELECT *
    INTO v_convite
  FROM public.convite_participacao_evento c
  WHERE c.id = p_convite_id
  LIMIT 1;

  IF v_convite.id IS NULL THEN
    RETURN QUERY SELECT false, 'Convite não encontrado.', NULL::UUID;
    RETURN;
  END IF;

  IF v_convite.status <> 'aceito' THEN
    RETURN QUERY SELECT false, 'Somente convites aceitos podem ser avaliados.', NULL::UUID;
    RETURN;
  END IF;

  IF v_convite.data_evento >= CURRENT_DATE THEN
    RETURN QUERY SELECT false, 'A avaliação é liberada somente após a conclusão do evento (D+1).', NULL::UUID;
    RETURN;
  END IF;

  IF NOT public._is_member_of_artist(v_uid, v_convite.artista_que_convidou_id, ARRAY['editor', 'admin', 'owner']) THEN
    RETURN QUERY SELECT false, 'Sem permissão para avaliar este artista.', NULL::UUID;
    RETURN;
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
  )
  VALUES (
    v_convite.id,
    v_convite.evento_origem_id,
    v_convite.artista_que_convidou_id,
    v_convite.artista_convidado_id,
    p_nota_geral,
    p_nota_pontualidade,
    p_nota_profissionalismo,
    p_nota_qualidade_tecnica,
    p_nota_comunicacao,
    NULLIF(TRIM(COALESCE(p_comentario_publico, '')), ''),
    NULLIF(TRIM(COALESCE(p_observacao_privada, '')), '')
  )
  ON CONFLICT (convite_participacao_evento_id)
  DO UPDATE SET
    nota_geral = EXCLUDED.nota_geral,
    nota_pontualidade = EXCLUDED.nota_pontualidade,
    nota_profissionalismo = EXCLUDED.nota_profissionalismo,
    nota_qualidade_tecnica = EXCLUDED.nota_qualidade_tecnica,
    nota_comunicacao = EXCLUDED.nota_comunicacao,
    comentario_publico = EXCLUDED.comentario_publico,
    observacao_privada = EXCLUDED.observacao_privada,
    atualizado_em = NOW()
  RETURNING id INTO avaliacao_id;

  RETURN QUERY SELECT true, NULL::TEXT, avaliacao_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_app_salvar_avaliacao_participacao_evento(
  UUID, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT, TEXT, TEXT
) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_app_listar_avaliacoes_participacao_evento(
  p_evento_origem_id UUID
)
RETURNS TABLE (
  convite_participacao_evento_id UUID,
  artista_avaliado_id UUID,
  nota_geral SMALLINT,
  nota_pontualidade SMALLINT,
  nota_profissionalismo SMALLINT,
  nota_qualidade_tecnica SMALLINT,
  nota_comunicacao SMALLINT,
  comentario_publico TEXT,
  observacao_privada TEXT,
  criado_em TIMESTAMPTZ,
  atualizado_em TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    a.convite_participacao_evento_id,
    a.artista_avaliado_id,
    a.nota_geral,
    a.nota_pontualidade,
    a.nota_profissionalismo,
    a.nota_qualidade_tecnica,
    a.nota_comunicacao,
    a.comentario_publico,
    a.observacao_privada,
    a.criado_em,
    a.atualizado_em
  FROM public.participacao_evento_avaliacoes a
  WHERE a.evento_origem_id = p_evento_origem_id
    AND EXISTS (
      SELECT 1
      FROM public.convite_participacao_evento c
      WHERE c.evento_origem_id = a.evento_origem_id
        AND (
          public._is_member_of_artist(auth.uid(), c.artista_que_convidou_id, NULL)
          OR public._is_member_of_artist(auth.uid(), c.artista_convidado_id, NULL)
        )
      LIMIT 1
    );
$$;

GRANT EXECUTE ON FUNCTION public.rpc_app_listar_avaliacoes_participacao_evento(UUID) TO authenticated;
