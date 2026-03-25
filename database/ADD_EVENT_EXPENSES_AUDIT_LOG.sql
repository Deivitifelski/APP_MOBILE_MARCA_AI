-- Registrar alterações de despesas no event_audit_log (mesma trilha do evento)
-- Cria triggers em event_expenses para inserir logs em public.event_audit_log.

create extension if not exists pgcrypto;

create or replace function public.fn_log_event_expense_change()
returns trigger
language plpgsql
as $$
declare
  actor uuid := auth.uid();
begin
  -- Ignorar despesas avulsas (sem evento)
  if (tg_op = 'INSERT') then
    if new.event_id is null then
      return new;
    end if;

    insert into public.event_audit_log (
      id, event_id, actor_user_id, action, changed_fields, old_data, new_data, created_at
    ) values (
      gen_random_uuid(),
      new.event_id,
      actor,
      'expense_add',
      array['expense'],
      '{}'::jsonb,
      jsonb_build_object(
        'expense_id', new.id,
        'expense_name', coalesce(new.name, new.description, 'Despesa'),
        'expense_value', new.value
      ),
      now()
    );
    return new;
  elsif (tg_op = 'UPDATE') then
    if new.event_id is null then
      return new;
    end if;

    insert into public.event_audit_log (
      id, event_id, actor_user_id, action, changed_fields, old_data, new_data, created_at
    ) values (
      gen_random_uuid(),
      new.event_id,
      actor,
      'expense_update',
      array['expense'],
      jsonb_build_object(
        'expense_id', old.id,
        'expense_name', coalesce(old.name, old.description, 'Despesa'),
        'expense_value', old.value
      ),
      jsonb_build_object(
        'expense_id', new.id,
        'expense_name', coalesce(new.name, new.description, 'Despesa'),
        'expense_value', new.value
      ),
      now()
    );
    return new;
  elsif (tg_op = 'DELETE') then
    if old.event_id is null then
      return old;
    end if;

    insert into public.event_audit_log (
      id, event_id, actor_user_id, action, changed_fields, old_data, new_data, created_at
    ) values (
      gen_random_uuid(),
      old.event_id,
      actor,
      'expense_delete',
      array['expense'],
      jsonb_build_object(
        'expense_id', old.id,
        'expense_name', coalesce(old.name, old.description, 'Despesa'),
        'expense_value', old.value
      ),
      '{}'::jsonb,
      now()
    );
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_log_event_expense_insert on public.event_expenses;
create trigger trg_log_event_expense_insert
after insert on public.event_expenses
for each row
execute function public.fn_log_event_expense_change();

drop trigger if exists trg_log_event_expense_update on public.event_expenses;
create trigger trg_log_event_expense_update
after update on public.event_expenses
for each row
execute function public.fn_log_event_expense_change();

drop trigger if exists trg_log_event_expense_delete on public.event_expenses;
create trigger trg_log_event_expense_delete
after delete on public.event_expenses
for each row
execute function public.fn_log_event_expense_change();

