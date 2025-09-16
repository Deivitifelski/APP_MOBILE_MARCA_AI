-- =====================================================
-- FUNÇÃO RPC: get_artist_collaborators
-- =====================================================

-- Criar função que busca colaboradores sem problemas de RLS
CREATE OR REPLACE FUNCTION get_artist_collaborators(artist_id UUID)
RETURNS TABLE (
  user_id UUID,
  artist_id UUID,
  role TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  user_name TEXT,
  user_email TEXT,
  user_profile_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar se o usuário atual é membro do artista
  IF NOT EXISTS (
    SELECT 1 FROM artist_members 
    WHERE artist_members.artist_id = get_artist_collaborators.artist_id 
    AND artist_members.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Usuário não tem acesso a este artista';
  END IF;

  -- Retornar todos os colaboradores do artista
  RETURN QUERY
  SELECT 
    am.user_id,
    am.artist_id,
    am.role,
    am.created_at,
    am.updated_at,
    u.name as user_name,
    u.email as user_email,
    u.profile_url as user_profile_url
  FROM artist_members am
  JOIN users u ON u.id = am.user_id
  WHERE am.artist_id = get_artist_collaborators.artist_id
  ORDER BY am.created_at ASC;
END;
$$;

-- =====================================================
-- FIM DA FUNÇÃO
-- =====================================================
