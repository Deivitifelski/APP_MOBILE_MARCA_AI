-- =====================================================
-- ADICIONAR COLUNA role NA TABELA notifications
-- Para guardar a role que será atribuída em convites
-- =====================================================

-- 1️⃣ Verificar se a coluna já existe
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'notifications' 
  AND table_schema = 'public'
  AND column_name = 'role';

-- 2️⃣ Adicionar coluna role se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns
    WHERE table_name = 'notifications'
      AND table_schema = 'public'
      AND column_name = 'role'
  ) THEN
    ALTER TABLE notifications 
      ADD COLUMN role TEXT CHECK (role IN ('viewer', 'editor', 'admin', 'owner'));
    
    RAISE NOTICE 'Coluna role adicionada com sucesso!';
  ELSE
    RAISE NOTICE 'Coluna role já existe.';
  END IF;
END $$;

-- 3️⃣ Verificar estrutura completa da tabela
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'notifications'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- =====================================================
-- ✅ PRONTO!
-- =====================================================
-- 
-- A coluna 'role' foi adicionada à tabela notifications
-- 
-- Valores permitidos: 'viewer', 'editor', 'admin', 'owner'
-- Sem valor padrão (será NULL para notificações que não são convites)
-- 
-- Agora quando criar uma notificação de convite, pode salvar
-- a role diretamente, sem precisar buscar na tabela artist_invites!
-- 
-- =====================================================

