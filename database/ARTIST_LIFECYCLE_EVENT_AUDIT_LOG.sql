-- =========================================================
-- AUDITORIA: criação / exclusão de ARTISTA em event_audit_log
-- =========================================================
--
-- Compatível com a tabela original de auditoria de EVENTOS, onde:
--   event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE
--
-- Para também registrar artista, é OBRIGATÓRIO permitir event_id NULL
-- (logs de artista não têm evento). A FK para events continua válida:
-- linhas com event_id preenchido continuam referenciando events;
-- linhas com event_id NULL não disparam a FK.
--
-- Execute este arquivo INTEIRO no SQL Editor do Supabase.
--
-- Depois de rodar, confira:
--   select tgname from pg_trigger
--   where tgrelid = 'public.artists'::regclass and tgname like 'trg_log_artist%';
--
--   select id, event_id, artist_id, action, actor_user_id, created_at
--   from public.event_audit_log
--   where action in ('artist_create', 'artist_delete')
--   order by created_at desc
--   limit 20;
--
-- Se você consulta o log só por event_id (ex.: tela de detalhe do evento),
-- linhas de artista (event_id IS NULL) não aparecem — use a query acima.
-- =========================================================

create extension if not exists pgcrypto;

-- 1) Obrigatório na DDL antiga (event_id NOT NULL)
alter table public.event_audit_log
  alter column event_id drop not null;

-- 2) Coluna opcional para filtrar por artista (sem FK para não conflitar com DELETE)
alter table public.event_audit_log
  add column if not exists artist_id uuid;

create index if not exists idx_event_audit_log_artist_created
  on public.event_audit_log (artist_id, created_at desc)
  where artist_id is not null;

create or replace function public.fn_log_artist_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into public.event_audit_log (
      event_id,
      artist_id,
      actor_user_id,
      action,
      changed_fields,
      old_data,
      new_data
    ) values (
      null,
      new.id,
      actor,
      'artist_create',
      array['artist']::text[],
      '{}'::jsonb,
      row_to_json(new)::jsonb
    );
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.event_audit_log (
      event_id,
      artist_id,
      actor_user_id,
      action,
      changed_fields,
      old_data,
      new_data
    ) values (
      null,
      old.id,
      actor,
      'artist_delete',
      array['artist']::text[],
      row_to_json(old)::jsonb,
      '{}'::jsonb
    );
    return old;
  end if;

  return null;
end;
$$;

-- Garante que o insert passe mesmo com RLS na tabela (comportamento comum no Supabase)
alter function public.fn_log_artist_lifecycle() owner to postgres;

drop trigger if exists trg_log_artist_insert on public.artists;
create trigger trg_log_artist_insert
after insert on public.artists
for each row
execute function public.fn_log_artist_lifecycle();

drop trigger if exists trg_log_artist_delete on public.artists;
create trigger trg_log_artist_delete
after delete on public.artists
for each row
execute function public.fn_log_artist_lifecycle();

comment on function public.fn_log_artist_lifecycle() is
  'Auditoria: insere em event_audit_log ao criar ou excluir artista (event_id nulo).';
