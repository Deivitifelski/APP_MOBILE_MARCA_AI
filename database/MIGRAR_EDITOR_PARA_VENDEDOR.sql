-- Remove a role 'editor' do produto: daqui pra frente só existem admin, vendedor e viewer.
-- Editores existentes viram 'vendedor' (decisão do time em 2026-08-03):
--   - Continuam podendo criar eventos.
--   - Passam a ver o valor (cachê) só dos eventos que eles mesmos criaram
--     (antes viam o valor de todos os eventos do artista).
--   - Deixam de poder editar/excluir eventos.
--
-- Pré-requisito: rode primeiro database/RPC_GET_EVENTS_ADD_VENDEDOR_ROLE.sql
-- (cria a role 'vendedor' nas funções/policies). Este script só migra os dados.
--
-- Rode no SQL Editor do Supabase. Idempotente — pode rodar mais de uma vez sem efeito colateral.

-- 1) Colaboradores ativos com role 'editor' -> 'vendedor'
UPDATE public.artist_members
SET role = 'vendedor'
WHERE role = 'editor';

-- 2) Convites pendentes com role 'editor' -> 'vendedor'
--    (evita que alguém aceite um convite antigo e vire 'editor' depois da migração)
UPDATE public.artist_invites
SET role = 'vendedor'
WHERE role = 'editor'
  AND status = 'pending';

-- 3) Notificações de convite pendentes que guardam a role em `notifications.role`
UPDATE public.notifications
SET role = 'vendedor'
WHERE role = 'editor';

-- =====================================================
-- Verificação
-- =====================================================
SELECT 'artist_members' AS tabela, role, COUNT(*) FROM public.artist_members GROUP BY role
UNION ALL
SELECT 'artist_invites', role, COUNT(*) FROM public.artist_invites GROUP BY role
UNION ALL
SELECT 'notifications', role, COUNT(*) FROM public.notifications WHERE role IS NOT NULL GROUP BY role
ORDER BY 1, 2;

-- Não deve sobrar nenhuma linha com role = 'editor' após rodar este script.
