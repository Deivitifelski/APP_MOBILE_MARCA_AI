-- ⚠️ NÃO execute este arquivo como “migração”.
--
-- `state_uf` já está incluído em database/RPC_RESTORE_GET_EVENTS_ORIGINAL.sql
-- (get_events_by_role e get_event_by_id_with_role). Rode esse script no SQL Editor quando precisar recriar as RPCs.

DO $$
BEGIN
  RAISE NOTICE 'RPC_GET_EVENTS_INCLUDE_STATE_UF.sql: use database/RPC_RESTORE_GET_EVENTS_ORIGINAL.sql para as RPCs da agenda.';
END $$;
