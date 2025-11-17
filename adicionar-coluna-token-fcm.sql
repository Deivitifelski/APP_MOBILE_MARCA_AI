-- =====================================================
-- ADICIONAR COLUNA TOKEN_FCM NA TABELA USERS
-- =====================================================

-- Adicionar coluna token_fcm na tabela users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS token_fcm TEXT;

-- Criar índice para melhor performance nas consultas por token
CREATE INDEX IF NOT EXISTS idx_users_token_fcm ON users(token_fcm) WHERE token_fcm IS NOT NULL;

-- Comentário sobre a coluna
COMMENT ON COLUMN users.token_fcm IS 'Token FCM (Firebase Cloud Messaging) para notificações push do usuário';

-- Verificar resultado
SELECT 
    id, 
    name, 
    email, 
    token_fcm,
    created_at
FROM users 
LIMIT 5;

