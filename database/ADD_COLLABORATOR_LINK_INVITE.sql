-- Convite de colaborador por link, para quem ainda não tem conta no MarcaAI.
--
-- Hoje o convite existente (tabela `notifications`, type='invite') exige um `to_user_id`
-- de um usuário que já existe — não dá pra convidar alguém que nunca baixou o app.
-- Esta migration adiciona um caminho paralelo: o admin/vendedor registra um convite
-- pendente por EMAIL (sem `to_user_id`), compartilha o link da loja por fora do app
-- (WhatsApp/SMS/etc.), e quando a pessoa cria conta com aquele mesmo email, um trigger
-- em `users` a adiciona automaticamente em `artist_members` — sem precisar de deep link
-- sobrevivendo à instalação do app.
--
-- Rode no SQL Editor do Supabase.

BEGIN;

CREATE TABLE IF NOT EXISTS public.pending_collaborator_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('viewer', 'vendedor', 'admin')),
  invited_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  consumed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_pending_collaborator_invites_email_pending
  ON public.pending_collaborator_invites (lower(email))
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pending_collaborator_invites_artist
  ON public.pending_collaborator_invites (artist_id);

ALTER TABLE public.pending_collaborator_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_vendedor_pode_criar_convite_por_link" ON public.pending_collaborator_invites;
CREATE POLICY "admin_vendedor_pode_criar_convite_por_link"
ON public.pending_collaborator_invites
FOR INSERT
TO authenticated
WITH CHECK (
  invited_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.artist_members am
    WHERE am.artist_id = pending_collaborator_invites.artist_id
      AND am.user_id = auth.uid()
      AND am.role IN ('admin', 'vendedor')
  )
);

DROP POLICY IF EXISTS "admin_vendedor_pode_ver_convites_por_link" ON public.pending_collaborator_invites;
CREATE POLICY "admin_vendedor_pode_ver_convites_por_link"
ON public.pending_collaborator_invites
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.artist_members am
    WHERE am.artist_id = pending_collaborator_invites.artist_id
      AND am.user_id = auth.uid()
      AND am.role IN ('admin', 'vendedor')
  )
);

-- =====================================================
-- Trigger: ao criar um usuário (qualquer método de cadastro — email, Google, Apple —
-- todos fazem um INSERT puro em `users` na primeira vez), consome convites pendentes
-- com o mesmo email e adiciona a pessoa como colaboradora automaticamente.
-- SECURITY DEFINER: necessário pra poder inserir em artist_members em nome de um usuário
-- que ainda não é admin/vendedor de nenhum artista (a policy normal de INSERT exigiria isso).
-- =====================================================

CREATE OR REPLACE FUNCTION public.consume_pending_collaborator_invites()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.artist_members (artist_id, user_id, role, created_at, updated_at)
  SELECT pci.artist_id, NEW.id, pci.role, now(), now()
  FROM public.pending_collaborator_invites pci
  WHERE lower(pci.email) = lower(NEW.email)
    AND pci.consumed_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.artist_members am
      WHERE am.artist_id = pci.artist_id AND am.user_id = NEW.id
    );

  UPDATE public.pending_collaborator_invites
  SET consumed_at = now()
  WHERE lower(email) = lower(NEW.email)
    AND consumed_at IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_consume_pending_collaborator_invites ON public.users;
CREATE TRIGGER trg_consume_pending_collaborator_invites
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.consume_pending_collaborator_invites();

COMMIT;

-- =====================================================
-- Verificação rápida
-- =====================================================
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_consume_pending_collaborator_invites';
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'pending_collaborator_invites';
