-- =====================================================
-- ADICIONAR COLUNA PLAN NA TABELA USERS
-- =====================================================

-- Adicionar coluna plan na tabela users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'premium'));

-- Atualizar usuários existentes para terem plano 'free' por padrão
UPDATE users 
SET plan = 'free' 
WHERE plan IS NULL;

-- Criar índice para melhor performance nas consultas por plano
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);

-- Comentário sobre a coluna
COMMENT ON COLUMN users.plan IS 'Plano do usuário: free (gratuito) ou premium (pago)';

-- =====================================================
-- VERIFICAÇÕES DE LIMITAÇÕES DO PLANO FREE
-- =====================================================

-- Função para verificar se usuário pode criar mais artistas
CREATE OR REPLACE FUNCTION can_user_create_artist(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_plan TEXT;
    artist_count INTEGER;
BEGIN
    -- Obter plano do usuário
    SELECT plan INTO user_plan 
    FROM users 
    WHERE id = p_user_id;
    
    -- Se não encontrar o usuário, retornar false
    IF user_plan IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Se for premium, pode criar ilimitados
    IF user_plan = 'premium' THEN
        RETURN TRUE;
    END IF;
    
    -- Se for free, verificar quantos artistas já possui
    SELECT COUNT(*) INTO artist_count
    FROM artists 
    WHERE user_id = p_user_id;
    
    -- Plano free permite apenas 1 artista
    RETURN artist_count < 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar se usuário pode exportar dados
CREATE OR REPLACE FUNCTION can_user_export_data(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_plan TEXT;
BEGIN
    -- Obter plano do usuário
    SELECT plan INTO user_plan 
    FROM users 
    WHERE id = p_user_id;
    
    -- Se não encontrar o usuário, retornar false
    IF user_plan IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Apenas usuários premium podem exportar dados
    RETURN user_plan = 'premium';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- POLÍTICAS RLS PARA LIMITAÇÕES DE PLANO
-- =====================================================

-- Política para limitar criação de artistas para plano free
-- (Esta política será aplicada no nível da aplicação, não no banco)

-- =====================================================
-- TESTES DAS FUNÇÕES
-- =====================================================

-- Exemplo de uso das funções:
-- SELECT can_user_create_artist('user-uuid-here');
-- SELECT can_user_export_data('user-uuid-here');

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================

