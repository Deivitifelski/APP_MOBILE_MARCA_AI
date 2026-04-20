-- =====================================================
-- VERIFICAR E REMOVER TRIGGERS DE NOTIFICAÇÃO DE EVENTOS
-- =====================================================

-- 1. Verificar todos os triggers na tabela events
SELECT 
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'events'
ORDER BY trigger_name;

-- 2. Verificar todas as functions relacionadas a notificações de eventos
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_type = 'FUNCTION'
  AND (
    routine_name LIKE '%notify%event%' OR 
    routine_name LIKE '%event%notification%' OR
    routine_definition LIKE '%notifications%'
  );

-- 3. Se encontrar triggers de notificação, execute os comandos abaixo para removê-los:
-- (Descomente e execute após verificar os nomes corretos)

/*
-- Remover trigger de evento criado (se existir)
DROP TRIGGER IF EXISTS trg_notify_event_created ON events;
DROP TRIGGER IF EXISTS notify_event_created ON events;
DROP TRIGGER IF EXISTS trigger_notify_event_created ON events;

-- Remover trigger de evento atualizado (se existir)
DROP TRIGGER IF EXISTS trg_notify_event_updated ON events;
DROP TRIGGER IF EXISTS notify_event_updated ON events;
DROP TRIGGER IF EXISTS trigger_notify_event_updated ON events;

-- Remover functions relacionadas (se existirem)
DROP FUNCTION IF EXISTS notify_collaborators_event_created();
DROP FUNCTION IF EXISTS notify_collaborators_event_updated();
DROP FUNCTION IF EXISTS notify_event_collaborators();
DROP FUNCTION IF EXISTS create_event_notifications();
*/

-- 4. Após executar as remoções, verificar novamente para confirmar
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'events'
ORDER BY trigger_name;

