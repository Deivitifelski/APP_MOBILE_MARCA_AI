import { supabase } from '../../lib/supabase';

export interface Event {
  id: string;
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
  confirmed: boolean;
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
  expenses?: CreateExpenseData[];
}

export interface CreateExpenseData {
  name: string;
  value: number;
  receipt_url?: string;
}

export interface UpdateEventData {
  nome?: string;
  valor?: number;
  cidade?: string;
  telefone_contratante?: string;
  data?: string;
  horario_inicio?: string;
  horario_fim?: string;
  status?: 'confirmado' | 'a_confirmar';
}

// Criar evento com despesas
export const createEvent = async (eventData: CreateEventData): Promise<{ success: boolean; error: string | null; event?: Event }> => {
  try {
    // Criar o evento
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        artist_id: eventData.artist_id,
        user_id: eventData.user_id,
        name: eventData.name,
        description: eventData.description || null,
        event_date: eventData.event_date,
        start_time: eventData.start_time,
        end_time: eventData.end_time,
        value: eventData.value || null,
        city: eventData.city || null,
        contractor_phone: eventData.contractor_phone || null,
        confirmed: eventData.confirmed || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (eventError) {
      return { success: false, error: eventError.message };
    }

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
      .update({
        ...eventData,
        updated_at: new Date().toISOString()
      })
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