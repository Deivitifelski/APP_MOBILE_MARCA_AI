-- Diagnóstico: descobre em qual etapa a role 'vendedor' vira 'viewer'.
-- Troque 'email@da-pessoa.com' pelo e-mail de quem você convidou.

-- 1) A notificação de convite guardou 'vendedor' ou já chegou como 'viewer'?
--    Se aqui já estiver 'viewer', o bug é na CRIAÇÃO do convite (colaboradores-artista.tsx
--    -> createArtistInvite -> createArtistInviteNotification).
SELECT n.id, n.type, n.role, n.status, n.created_at, u.email AS convidado
FROM public.notifications n
JOIN public.users u ON u.id = n.to_user_id
WHERE u.email = 'email@da-pessoa.com'
  AND n.type = 'invite'
ORDER BY n.created_at DESC
LIMIT 5;

-- 2) A linha final em artist_members está com qual role?
--    Se aqui está 'viewer' mas a notificação (query 1) mostrou 'vendedor',
--    o bug é na ACEITAÇÃO do convite (acceptArtistInvite).
SELECT am.artist_id, am.user_id, am.role, am.created_at, u.email AS colaborador
FROM public.artist_members am
JOIN public.users u ON u.id = am.user_id
WHERE u.email = 'email@da-pessoa.com'
ORDER BY am.created_at DESC
LIMIT 5;
