-- =====================================================
-- HABILITAR REALTIME NA TABELA EVENTS
-- =====================================================
-- Necessário para a agenda atualizar em tempo real ao adicionar/deletar eventos.
-- Execute no Supabase SQL Editor.

-- Adicionar tabela events à publicação do Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE events;

-- Verificar se foi adicionada:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
