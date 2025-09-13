import { supabase } from '../../lib/supabase';

export interface Expense {
  id: string;
  event_id: string;
  name: string;
  value: number;
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