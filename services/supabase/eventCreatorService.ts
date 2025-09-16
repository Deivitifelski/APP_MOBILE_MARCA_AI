import { supabase } from '../../lib/supabase';

// Buscar nome do usuário que criou o evento
export const getEventCreatorName = async (userId: string): Promise<{ name: string | null; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Erro ao buscar nome do criador do evento:', error);
      return { name: null, error: error.message };
    }

    return { name: data?.name || null, error: null };
  } catch (error) {
    console.error('Erro ao buscar nome do criador do evento:', error);
    return { name: null, error: 'Erro ao buscar nome do criador do evento' };
  }
};
