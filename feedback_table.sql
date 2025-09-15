-- Script para criar a tabela feedback_usuario
-- Execute este script no Supabase SQL Editor se a tabela ainda não existir

-- Tabela de feedback do usuário
CREATE TABLE IF NOT EXISTS feedback_usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT CHECK (tipo IN ('bug', 'melhoria')) NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_feedback_usuario_user_id ON feedback_usuario(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_usuario_created_at ON feedback_usuario(created_at);

-- Habilitar RLS
ALTER TABLE feedback_usuario ENABLE ROW LEVEL SECURITY;

-- Políticas para feedback_usuario (usuários só podem ver e criar seus próprios feedbacks)
CREATE POLICY "Users can view their own feedback" ON feedback_usuario
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own feedback" ON feedback_usuario
    FOR INSERT WITH CHECK (user_id = auth.uid());
