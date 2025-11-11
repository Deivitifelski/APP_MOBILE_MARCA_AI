import { supabase } from '../../lib/supabase';

export interface Expense {
  id: string;
  event_id: string | null; // Nullable para despesas avulsas
  artist_id?: string;
  name?: string;
  description?: string;
  value: number;
  category?: string;
  date?: string;
  notes?: string;
  receipt_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateExpenseData {
  name: string;
  value: number;
  receipt_url?: string;
}

export interface UpdateExpenseData {
  name?: string;
  value?: number;
  receipt_url?: string;
}

// Interface para despesas avulsas (sem evento)
export interface CreateStandaloneExpenseData {
  artist_id: string;
  description: string;
  value: number;
  category: string;
  date: string;
  notes?: string;
  event_id?: null; // Explicitamente null
}

// Criar despesa
export const createExpense = async (eventId: string, expenseData: CreateExpenseData): Promise<{ success: boolean; error: string | null; expense?: Expense }> => {
  try {
    const { data, error } = await supabase
      .from('event_expenses')
      .insert({
        event_id: eventId,
        name: expenseData.name,
        value: expenseData.value,
        receipt_url: expenseData.receipt_url || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null, expense: data };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Buscar despesas do evento
export const getExpensesByEvent = async (eventId: string): Promise<{ success: boolean; error: string | null; expenses?: Expense[] }> => {
  try {
    const { data, error } = await supabase
      .from('event_expenses')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null, expenses: data || [] };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Buscar despesa por ID
export const getExpenseById = async (expenseId: string): Promise<{ success: boolean; error: string | null; expense?: Expense }> => {
  try {
    const { data, error } = await supabase
      .from('event_expenses')
      .select('*')
      .eq('id', expenseId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null, expense: data };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Atualizar despesa
export const updateExpense = async (expenseId: string, expenseData: UpdateExpenseData): Promise<{ success: boolean; error: string | null; expense?: Expense }> => {
  try {
    const { data, error } = await supabase
      .from('event_expenses')
      .update({
        ...expenseData,
        updated_at: new Date().toISOString()
      })
      .eq('id', expenseId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null, expense: data };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Deletar despesa
export const deleteExpense = async (expenseId: string): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase
      .from('event_expenses')
      .delete()
      .eq('id', expenseId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Calcular total de despesas do evento
export const getTotalExpensesByEvent = async (eventId: string): Promise<{ success: boolean; error: string | null; total?: number }> => {
  try {
    const { data, error } = await supabase
      .from('event_expenses')
      .select('value')
      .eq('event_id', eventId);

    if (error) {
      return { success: false, error: error.message };
    }

    const total = data?.reduce((sum, expense) => sum + expense.value, 0) || 0;
    return { success: true, error: null, total };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// ========== DESPESAS AVULSAS (SEM EVENTO) ==========

// Criar despesa avulsa (sem evento)
export const createStandaloneExpense = async (expenseData: CreateStandaloneExpenseData): Promise<{ success: boolean; error: string | null; expense?: Expense }> => {
  try {
    const { data, error } = await supabase
      .from('event_expenses')
      .insert({
        artist_id: expenseData.artist_id,
        event_id: null, // Explicitamente null para despesas avulsas
        description: expenseData.description,
        value: expenseData.value,
        category: expenseData.category,
        date: expenseData.date,
        notes: expenseData.notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null, expense: data };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Buscar despesas avulsas de um artista (sem evento)
export const getStandaloneExpensesByArtist = async (artistId: string, month?: number, year?: number): Promise<{ success: boolean; error: string | null; expenses?: Expense[] }> => {
  try {
    let query = supabase
      .from('event_expenses')
      .select('*')
      .eq('artist_id', artistId)
      .is('event_id', null); // Apenas despesas sem evento

    if (month !== undefined && year !== undefined) {
      // Filtrar por mês/ano
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
      query = query.gte('date', startDate).lte('date', endDate);
    }

    const { data, error } = await query.order('date', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null, expenses: data || [] };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Deletar despesa avulsa
export const deleteStandaloneExpense = async (expenseId: string): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase
      .from('event_expenses')
      .delete()
      .eq('id', expenseId)
      .is('event_id', null); // Apenas despesas sem evento

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};