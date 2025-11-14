-- =====================================================
-- REMOVER TRIGGERS DE EVENTOS PARA EVITAR DUPLICAÇÃO
-- =====================================================
-- Remove os triggers SQL que criam notificações automaticamente
-- pois o código TypeScript já cria as notificações
-- Isso evita notificações duplicadas

-- 1. Remover todos os triggers relacionados a eventos
DROP TRIGGER IF EXISTS trg_notify_event_created ON events;
DROP TRIGGER IF EXISTS notify_event_created_trigger ON events;
DROP TRIGGER IF EXISTS notify_event_created ON events;
DROP TRIGGER IF EXISTS trigger_notify_event_created ON events;

DROP TRIGGER IF EXISTS trg_notify_event_updated ON events;
DROP TRIGGER IF EXISTS notify_event_updated_trigger ON events;
DROP TRIGGER IF EXISTS notify_event_updated ON events;
DROP TRIGGER IF EXISTS trigger_notify_event_updated ON events;

-- 2. Remover as funções (opcional, mas recomendado para limpeza)
DROP FUNCTION IF EXISTS notify_event_created() CASCADE;
DROP FUNCTION IF EXISTS notify_event_updated() CASCADE;
DROP FUNCTION IF EXISTS notify_collaborators_event_created() CASCADE;
DROP FUNCTION IF EXISTS notify_collaborators_event_updated() CASCADE;

-- 3. Verificar se ainda existem triggers (deve retornar vazio)
SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'events'
  AND trigger_schema = 'public';

-- =====================================================
-- ✅ PRONTO!
-- =====================================================
-- Agora as notificações serão criadas APENAS pelo
-- código TypeScript (notificationManager.ts) quando
-- um evento for criado ou atualizado.
-- 
-- Isso evita notificações duplicadas.
-- =====================================================

