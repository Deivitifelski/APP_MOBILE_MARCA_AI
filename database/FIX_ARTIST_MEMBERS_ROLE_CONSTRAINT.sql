-- Corrige o erro ao aceitar convite/adicionar colaborador com role = 'vendedor':
-- a tabela `artist_members` tem um CHECK constraint em `role` que ainda não inclui 'vendedor'.
-- Esse constraint não está em nenhum script versionado neste repositório (a tabela é anterior
-- ao histórico de SQL aqui), então este script descobre o nome real dele em tempo de execução
-- e recria incluindo 'vendedor' — sem precisar saber o nome de antemão.
--
-- Mantém 'editor' na lista permitida por segurança (caso ainda existam linhas com role='editor'
-- não migradas — rodar MIGRAR_EDITOR_PARA_VENDEDOR.sql antes ou depois, na ordem que preferir).
--
-- Rode no SQL Editor do Supabase. Idempotente.

DO $$
DECLARE
  constraint_name_var TEXT;
BEGIN
  SELECT con.conname INTO constraint_name_var
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
  WHERE rel.relname = 'artist_members'
    AND att.attname = 'role'
    AND con.contype = 'c';

  IF constraint_name_var IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.artist_members DROP CONSTRAINT %I', constraint_name_var);
    RAISE NOTICE 'Constraint antigo removido: %', constraint_name_var;
  ELSE
    RAISE NOTICE 'Nenhum CHECK constraint encontrado em artist_members.role (pode ser um tipo ENUM — ver nota abaixo).';
  END IF;

  ALTER TABLE public.artist_members
    ADD CONSTRAINT artist_members_role_check
    CHECK (role IN ('viewer', 'editor', 'vendedor', 'admin', 'owner'));
END $$;

-- =====================================================
-- Mesma correção em artist_invites.role, caso exista o mesmo tipo de constraint lá
-- (convites pendentes também gravam a role escolhida).
-- =====================================================

DO $$
DECLARE
  constraint_name_var TEXT;
BEGIN
  SELECT con.conname INTO constraint_name_var
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
  WHERE rel.relname = 'artist_invites'
    AND att.attname = 'role'
    AND con.contype = 'c';

  IF constraint_name_var IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.artist_invites DROP CONSTRAINT %I', constraint_name_var);
    RAISE NOTICE 'Constraint antigo removido: %', constraint_name_var;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'artist_invites' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.artist_invites
      ADD CONSTRAINT artist_invites_role_check
      CHECK (role IN ('viewer', 'editor', 'vendedor', 'admin', 'owner'));
  END IF;
END $$;

-- =====================================================
-- Verificação
-- =====================================================

-- Se esta query retornar uma linha com "check_clause" mostrando as roles antigas sem 'vendedor',
-- o fix não pegou o constraint certo — provavelmente `role` é um tipo ENUM, não TEXT+CHECK.
SELECT tc.table_name, tc.constraint_name, cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc ON cc.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('artist_members', 'artist_invites')
  AND tc.constraint_type = 'CHECK';

-- Se `role` for um tipo ENUM (ex: user_role), rode isto em vez do bloco acima:
-- ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'vendedor';
-- (troque "user_role" pelo nome real do tipo — descubra com a query abaixo)
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('artist_members', 'artist_invites')
  AND column_name = 'role';
