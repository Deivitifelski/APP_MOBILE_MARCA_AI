-- Convites de participação em evento: quem convida mantém o evento na própria agenda;
-- ao aceitar, cria-se uma linha em events na agenda do artista convidado.
-- Execute no SQL Editor do Supabase.

-- 1) Coluna em events: marca evento criado a partir de um convite aceito
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS convite_participacao_id UUID;

-- FK será adicionada após criar a tabela de convites (referência circular resolvida no final)

-- 2) Tabela de convites
CREATE TABLE IF NOT EXISTS convite_participacao_evento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_origem_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  artista_que_convidou_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  artista_convidado_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aceito', 'recusado', 'cancelado')),
  mensagem TEXT,
  nome_evento TEXT NOT NULL,
  data_evento DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  cache_valor NUMERIC(12,2),
  cidade TEXT,
  telefone_contratante TEXT,
  descricao TEXT,
  funcao_participacao TEXT,
  evento_criado_convidado_id UUID REFERENCES events(id) ON DELETE SET NULL,
  usuario_que_enviou_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  respondido_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT convite_part_nao_convidar_si_mesmo CHECK (artista_que_convidou_id <> artista_convidado_id)
);

CREATE INDEX IF NOT EXISTS idx_convite_part_evento_origem ON convite_participacao_evento(evento_origem_id);
CREATE INDEX IF NOT EXISTS idx_convite_part_convidado ON convite_participacao_evento(artista_convidado_id);
CREATE INDEX IF NOT EXISTS idx_convite_part_status ON convite_participacao_evento(status);

-- Só um convite pendente por (evento + artista convidado)
CREATE UNIQUE INDEX IF NOT EXISTS idx_convite_part_um_pendente
  ON convite_participacao_evento (evento_origem_id, artista_convidado_id)
  WHERE status = 'pendente';

ALTER TABLE convite_participacao_evento
  ADD COLUMN IF NOT EXISTS funcao_participacao TEXT;

COMMENT ON TABLE convite_participacao_evento IS 'Convite para outro artista participar; ao aceitar, evento_criado_convidado_id aponta para events do convidado.';

CREATE OR REPLACE FUNCTION trg_convite_participacao_set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_convite_part_atualizado_em ON convite_participacao_evento;
CREATE TRIGGER trg_convite_part_atualizado_em
  BEFORE UPDATE ON convite_participacao_evento
  FOR EACH ROW
  EXECUTE FUNCTION trg_convite_participacao_set_atualizado_em();

-- 3) FK events.convite_participacao_id -> convite (depois da tabela existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_convite_participacao_id_fkey'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_convite_participacao_id_fkey
      FOREIGN KEY (convite_participacao_id) REFERENCES convite_participacao_evento(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_events_convite_participacao_unico
  ON events (convite_participacao_id)
  WHERE convite_participacao_id IS NOT NULL;

-- 4) Busca de artistas para enviar convite (não expõe política aberta em artists)
--    Comparação sem acentos (ex.: "joao" encontra "João") apenas em artists.name.
--    Retorna profile_url (foto do artista) e image_url (foto para exibir: artista ou fallback do membro).
CREATE OR REPLACE FUNCTION public.normalize_pt_search(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT translate(
    lower(trim(coalesce(input, ''))),
    'áàãâäéèêëíìîïóòõôöúùûüçñÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
  );
$$;

CREATE OR REPLACE FUNCTION public.buscar_artistas_para_convite(p_termo text, p_excluir_artista_id uuid)
RETURNS TABLE (id uuid, name text, profile_url text, image_url text, musical_style text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    a.id,
    a.name,
    a.profile_url,
    COALESCE(
      NULLIF(trim(COALESCE(a.profile_url, '')), ''),
      lu.member_profile_url
    ) AS image_url,
    a.musical_style
  FROM artists a
  LEFT JOIN LATERAL (
    SELECT u.profile_url AS member_profile_url
    FROM artist_members am
    INNER JOIN users u ON u.id = am.user_id
    WHERE am.artist_id = a.id
      AND u.profile_url IS NOT NULL
      AND trim(COALESCE(u.profile_url, '')) <> ''
    ORDER BY
      CASE am.role
        WHEN 'owner' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'editor' THEN 3
        ELSE 4
      END,
      am.created_at ASC NULLS LAST
    LIMIT 1
  ) lu ON true
  WHERE (p_excluir_artista_id IS NULL OR a.id <> p_excluir_artista_id)
    AND length(trim(coalesce(p_termo, ''))) >= 2
    AND length(public.normalize_pt_search(p_termo)) >= 2
    AND strpos(public.normalize_pt_search(a.name), public.normalize_pt_search(p_termo)) > 0
  ORDER BY a.name;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_artistas_para_convite(text, uuid) TO authenticated;

-- 5) RLS
ALTER TABLE convite_participacao_evento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS convite_part_select ON convite_participacao_evento;
DROP POLICY IF EXISTS convite_part_insert ON convite_participacao_evento;
DROP POLICY IF EXISTS convite_part_update ON convite_participacao_evento;
DROP POLICY IF EXISTS convite_part_delete ON convite_participacao_evento;

CREATE POLICY convite_part_select ON convite_participacao_evento
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM artist_members am
      WHERE am.artist_id = convite_participacao_evento.artista_que_convidou_id
        AND am.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM artist_members am
      WHERE am.artist_id = convite_participacao_evento.artista_convidado_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY convite_part_insert ON convite_participacao_evento
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM events e
      INNER JOIN artist_members am ON am.artist_id = e.artist_id
      WHERE e.id = evento_origem_id
        AND e.artist_id = artista_que_convidou_id
        AND am.user_id = auth.uid()
        AND am.role IN ('editor', 'admin', 'owner')
    )
    AND artista_que_convidou_id = (SELECT e2.artist_id FROM events e2 WHERE e2.id = evento_origem_id)
  );

CREATE POLICY convite_part_update ON convite_participacao_evento
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM artist_members am
      WHERE am.artist_id = convite_participacao_evento.artista_convidado_id
        AND am.user_id = auth.uid()
        AND am.role IN ('editor', 'admin', 'owner')
    )
    OR EXISTS (
      SELECT 1 FROM artist_members am
      WHERE am.artist_id = convite_participacao_evento.artista_que_convidou_id
        AND am.user_id = auth.uid()
        AND am.role IN ('editor', 'admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM artist_members am
      WHERE am.artist_id = convite_participacao_evento.artista_convidado_id
        AND am.user_id = auth.uid()
        AND am.role IN ('editor', 'admin', 'owner')
    )
    OR EXISTS (
      SELECT 1 FROM artist_members am
      WHERE am.artist_id = convite_participacao_evento.artista_que_convidou_id
        AND am.user_id = auth.uid()
        AND am.role IN ('editor', 'admin', 'owner')
    )
  );

-- Opcional: sem DELETE; use status cancelado
CREATE POLICY convite_part_delete ON convite_participacao_evento
  FOR DELETE
  USING (false);
