-- Script simples para adicionar coluna plan na tabela users
-- Execute este script no Supabase SQL Editor

-- 1. Adicionar coluna plan se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'plan'
    ) THEN
        ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free';
        RAISE NOTICE 'Coluna plan adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna plan já existe';
    END IF;
END $$;

-- 2. Adicionar constraint para valores válidos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'users_plan_check'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_plan_check CHECK (plan IN ('free', 'premium'));
        RAISE NOTICE 'Constraint adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Constraint já existe';
    END IF;
END $$;

-- 3. Atualizar usuários existentes para terem plano 'free'
UPDATE users SET plan = 'free' WHERE plan IS NULL;

-- 4. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);

-- 5. Verificar resultado
SELECT 
    id, 
    name, 
    email, 
    plan,
    created_at
FROM users 
LIMIT 5;

