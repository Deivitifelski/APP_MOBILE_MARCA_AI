-- =====================================================
-- DEBUGAR TRIGGER DE NOTIFICAÇÃO DE EVENTOS
-- =====================================================

-- 1. Verificar se o campo created_by está sendo preenchido nos eventos
SELECT 
  id,
  name,
  created_by,
  artist_id,
  event_date,
  created_at
FROM events
ORDER BY created_at DESC
LIMIT 10;

-- 2. Para cada evento recente, verificar quem recebeu notificação
SELECT 
  e.id as event_id,
  e.name as event_name,
  e.created_by as creator_id,
  n.user_id as notified_user_id,
  n.title,
  n.type,
  (e.created_by = n.user_id) as is_creator_notified,  -- TRUE se criador foi notificado (PROBLEMA!)
  n.created_at as notification_created_at
FROM events e
LEFT JOIN notifications n ON n.event_id = e.id AND n.type = 'event_created'
WHERE e.created_at > NOW() - INTERVAL '7 days'
ORDER BY e.created_at DESC;

-- 3. Verificar se há casos onde o criador recebeu notificação (BUG)
SELECT 
  e.id as event_id,
  e.name as event_name,
  e.created_by,
  u.name as creator_name,
  COUNT(n.id) as total_notifications,
  COUNT(CASE WHEN n.user_id = e.created_by THEN 1 END) as creator_notified_count
FROM events e
LEFT JOIN notifications n ON n.event_id = e.id AND n.type = 'event_created'
LEFT JOIN users u ON u.id = e.created_by
WHERE e.created_at > NOW() - INTERVAL '7 days'
GROUP BY e.id, e.name, e.created_by, u.name
HAVING COUNT(CASE WHEN n.user_id = e.created_by THEN 1 END) > 0  -- Só mostrar se criador foi notificado
ORDER BY e.created_at DESC;

-- 4. Verificar os membros do artista vs notificações criadas
-- Substitua SEU_EVENT_ID pelo ID de um evento recente
/*
WITH event_info AS (
  SELECT 
    id,
    name,
    created_by,
    artist_id
  FROM events
  WHERE id = 'SEU_EVENT_ID'
),
members AS (
  SELECT 
    am.user_id,
    u.name,
    (am.user_id = ei.created_by) as is_creator
  FROM artist_members am
  JOIN event_info ei ON ei.artist_id = am.artist_id
  LEFT JOIN users u ON u.id = am.user_id
)
SELECT 
  m.user_id,
  m.name,
  m.is_creator,
  CASE WHEN n.id IS NOT NULL THEN 'SIM' ELSE 'NÃO' END as recebeu_notificacao
FROM members m
LEFT JOIN notifications n ON n.user_id = m.user_id 
  AND n.event_id = (SELECT id FROM event_info)
  AND n.type = 'event_created';
*/

-- 5. Verificar o conteúdo exato do trigger
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
WHERE p.proname = 'notify_event_created';

