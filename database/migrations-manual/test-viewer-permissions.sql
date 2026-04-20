-- Script para verificar permissões do usuário
-- Execute no SQL Editor do Supabase

-- 1. Ver todos os registros de artist_members
SELECT 
  am.id,
  am.user_id,
  u.name as user_name,
  u.email as user_email,
  am.artist_id,
  a.name as artist_name,
  am.role,
  am.created_at
FROM artist_members am
LEFT JOIN users u ON u.id = am.user_id
LEFT JOIN artists a ON a.id = am.artist_id
ORDER BY am.created_at DESC;

-- 2. Ver roles específicas
SELECT 
  role,
  COUNT(*) as total
FROM artist_members
GROUP BY role;

-- 3. Se quiser criar um usuário viewer para testar:
-- (Substitua os IDs pelos seus)
/*
INSERT INTO artist_members (user_id, artist_id, role)
VALUES (
  'SEU_USER_ID_AQUI',
  'SEU_ARTIST_ID_AQUI',
  'viewer'
);
*/

