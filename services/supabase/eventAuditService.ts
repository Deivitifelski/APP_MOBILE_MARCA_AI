import { supabase } from '../../lib/supabase';

export type EventAuditLogRow = {
  id: string;
  event_id: string;
  actor_user_id: string | null;
  action: string;
  changed_fields: string[];
  old_data: Record<string, any>;
  new_data: Record<string, any>;
  created_at: string;
  actor_name?: string | null;
  actor_profile_url?: string | null;
};

export async function getEventAuditLog(eventId: string, limit = 50): Promise<{
  logs: EventAuditLogRow[];
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from('event_audit_log')
      .select('id,event_id,actor_user_id,action,changed_fields,old_data,new_data,created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return { logs: [], error: error.message };

    const logs = (data as EventAuditLogRow[]) || [];
    const actorIds = Array.from(new Set(logs.map((l) => l.actor_user_id).filter(Boolean))) as string[];

    if (actorIds.length === 0) return { logs, error: null };

    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id,name,profile_url')
      .in('id', actorIds);

    if (usersError) {
      // se falhar o nome, devolve logs sem nome (não bloqueia)
      return { logs, error: null };
    }

    const metaById = new Map<string, { name: string | null; profile_url: string | null }>();
    for (const u of usersData || []) {
      if (u?.id) metaById.set(u.id, { name: u?.name ?? null, profile_url: u?.profile_url ?? null });
    }

    return {
      logs: logs.map((l) => {
        const meta = l.actor_user_id ? metaById.get(l.actor_user_id) : undefined;
        return {
          ...l,
          actor_name: meta?.name ?? null,
          actor_profile_url: meta?.profile_url ?? null,
        };
      }),
      error: null,
    };
  } catch {
    return { logs: [], error: 'Erro de conexão' };
  }
}

