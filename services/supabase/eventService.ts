import { supabase } from '../../lib/supabase';
import { hasPermission } from './permissionsService';

export interface Event {
  id: string;
  artist_id: string;
  created_by: string;
  name: string;
  description?: string;
  event_date: string;
  start_time: string;
  end_time: string;
  value?: number;
  city?: string;
  contractor_phone?: string;
  confirmed: boolean;
  tag: 'ensaio' | 'evento' | 'reunião';
  created_at: string;
  updated_at: string;
}

export interface EventExpense {
  id: string;
  event_id: string;
  name: string;
  value: number;
  receipt_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateEventData {
  artist_id: string;
  user_id: string;
  name: string;
  description?: string;
  event_date: string;
  start_time: string;
  end_time: string;
  value?: number;
  city?: string;
  contractor_phone?: string;
  confirmed?: boolean;
  tag?: 'ensaio' | 'evento' | 'reunião';
  expenses?: CreateExpenseData[];
}

export interface CreateExpenseData {
  name: string;
  value: number;
  receipt_url?: string;
}

export interface UpdateEventData {
  name?: string;
  description?: string;
  value?: number;
  city?: string;
  contractor_phone?: string;
  event_date?: string;
  start_time?: string;
  end_time?: string;
  confirmed?: boolean;
  tag?: 'ensaio' | 'evento' | 'reunião';
}

// Criar evento com despesas
export const createEvent = async (eventData: CreateEventData): Promise<{ success: boolean; error: string | null; event?: Event }> => {
  try {
    // Criar o evento
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        artist_id: eventData.artist_id,
        created_by: eventData.user_id, // Campo para o trigger
        name: eventData.name,
        description: eventData.description || null,
        event_date: eventData.event_date,
        start_time: eventData.start_time,
        end_time: eventData.end_time,
        value: eventData.value || null,
        city: eventData.city || null,
        contractor_phone: eventData.contractor_phone || null,
        confirmed: eventData.confirmed || false,
        tag: eventData.tag || 'evento', // Default para 'evento' se não especificado
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (eventError) {
      return { success: false, error: eventError.message };
    }

    // O trigger trg_notify_event_created executará automaticamente
    // e criará as notificações para os colaboradores

    // Se há despesas, criar elas
    if (eventData.expenses && eventData.expenses.length > 0) {
      const expensesToInsert = eventData.expenses.map(expense => ({
        event_id: event.id,
        name: expense.name,
        value: expense.value,
        receipt_url: expense.receipt_url || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error: expensesError } = await supabase
        .from('event_expenses')
        .insert(expensesToInsert);

      if (expensesError) {
        // Se der erro nas despesas, deletar o evento criado
        await supabase.from('events').delete().eq('id', event.id);
        return { success: false, error: expensesError.message };
      }
    }

    return { success: true, error: null, event };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Buscar eventos do artista
export const getEventsByArtist = async (artistId: string): Promise<{ success: boolean; error: string | null; events?: Event[] }> => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('artist_id', artistId)
      .order('event_date', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null, events: data || [] };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Buscar eventos por mês
export const getEventsByMonth = async (artistId: string, year: number, month: number): Promise<{ success: boolean; error: string | null; events?: Event[] }> => {
  try {
    const startDate = new Date(year, month, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

    console.log('getEventsByMonth: Buscando eventos para artista:', artistId, 'De:', startDate, 'Até:', endDate);

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('artist_id', artistId)
      .gte('event_date', startDate)
      .lte('event_date', endDate)
      .order('event_date', { ascending: true });

    console.log('getEventsByMonth: Resultado da query:', { data, error });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null, events: data || [] };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Buscar evento por ID
export const getEventById = async (eventId: string): Promise<{ success: boolean; error: string | null; event?: Event }> => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null, event: data };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Atualizar evento
export const updateEvent = async (eventId: string, eventData: UpdateEventData): Promise<{ success: boolean; error: string | null; event?: Event }> => {
  try {
    const { data, error } = await supabase
      .from('events')
      .update(eventData)
      .eq('id', eventId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null, event: data };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Deletar evento
export const deleteEvent = async (eventId: string): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// =====================================================
// FUNÇÕES COM VERIFICAÇÃO DE PERMISSÕES
// =====================================================

// Buscar eventos com verificação de permissões
export const getEventsWithPermissions = async (artistId: string, userId: string): Promise<{ events: Event[] | null; error: string | null }> => {
  try {
    // Verificar se o usuário tem permissão para visualizar eventos
    const canView = await hasPermission(userId, artistId, 'canViewEvents');
    if (!canView) {
      return { events: null, error: 'Sem permissão para visualizar eventos' };
    }

    // Usar a função do banco que filtra por role
    const { data, error } = await supabase
      .rpc('get_events_by_role', { p_artist_id: artistId });

    if (error) {
      console.error('Erro ao buscar eventos:', error);
      return { events: null, error: error.message };
    }

    return { events: data || [], error: null };
  } catch (error) {
    console.error('Erro ao buscar eventos:', error);
    return { events: null, error: 'Erro ao buscar eventos' };
  }
};

// Criar evento com verificação de permissões
export const createEventWithPermissions = async (eventData: CreateEventData, userId: string): Promise<{ success: boolean; error: string | null }> => {
  try {
    // Verificar se o usuário tem permissão para criar eventos
    const canCreate = await hasPermission(userId, eventData.artist_id, 'canCreateEvents');
    if (!canCreate) {
      return { success: false, error: 'Sem permissão para criar eventos' };
    }

    // Criar o evento
    return await createEvent(eventData);
  } catch (error) {
    console.error('Erro ao criar evento:', error);
    return { success: false, error: 'Erro ao criar evento' };
  }
};

// Atualizar evento com verificação de permissões
export const updateEventWithPermissions = async (eventId: string, eventData: UpdateEventData, userId: string): Promise<{ success: boolean; error: string | null }> => {
  try {
    // Primeiro, buscar o evento para obter o artist_id
    const eventResult = await getEventById(eventId);
    if (!eventResult.success || !eventResult.event) {
      return { success: false, error: 'Evento não encontrado' };
    }

    // Verificar se o usuário tem permissão para editar eventos
    const canEdit = await hasPermission(userId, eventResult.event.artist_id, 'canEditEvents');
    if (!canEdit) {
      return { success: false, error: 'Sem permissão para editar eventos' };
    }

    // Atualizar o evento
    return await updateEvent(eventId, eventData);
  } catch (error) {
    console.error('Erro ao atualizar evento:', error);
    return { success: false, error: 'Erro ao atualizar evento' };
  }
};

// Deletar evento com verificação de permissões
export const deleteEventWithPermissions = async (eventId: string, userId: string): Promise<{ success: boolean; error: string | null }> => {
  try {
    // Primeiro, buscar o evento para obter o artist_id
    const eventResult = await getEventById(eventId);
    if (!eventResult.success || !eventResult.event) {
      return { success: false, error: 'Evento não encontrado' };
    }

    // Verificar se o usuário tem permissão para deletar eventos
    const canDelete = await hasPermission(userId, eventResult.event.artist_id, 'canDeleteEvents');
    if (!canDelete) {
      return { success: false, error: 'Sem permissão para deletar eventos' };
    }

    // Deletar o evento
    return await deleteEvent(eventId);
  } catch (error) {
    console.error('Erro ao deletar evento:', error);
    return { success: false, error: 'Erro ao deletar evento' };
  }
};

// Buscar evento por ID com verificação de permissões
export const getEventByIdWithPermissions = async (eventId: string, userId: string): Promise<{ event: Event | null; error: string | null }> => {
  try {
    // Primeiro, buscar o evento
    const eventResult = await getEventById(eventId);
    if (!eventResult.success || !eventResult.event) {
      return { event: null, error: 'Evento não encontrado' };
    }

    // Verificar se o usuário tem permissão para visualizar eventos
    const canView = await hasPermission(userId, eventResult.event.artist_id, 'canViewEvents');
    if (!canView) {
      return { event: null, error: 'Sem permissão para visualizar este evento' };
    }

    // Verificar se o usuário pode ver valores financeiros
    const canViewFinancials = await hasPermission(userId, eventResult.event.artist_id, 'canViewFinancials');
    
    // Se não pode ver finanças, remover o valor
    if (!canViewFinancials) {
      eventResult.event.value = undefined;
    }

    return { event: eventResult.event, error: null };
  } catch (error) {
    console.error('Erro ao buscar evento:', error);
    return { event: null, error: 'Erro ao buscar evento' };
  }
};