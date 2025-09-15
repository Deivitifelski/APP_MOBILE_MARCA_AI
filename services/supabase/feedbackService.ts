import { supabase } from '../../lib/supabase';

export interface FeedbackData {
  tipo: 'bug' | 'melhoria';
  titulo: string;
  descricao: string;
}

export interface FeedbackResult {
  success: boolean;
  error?: string;
  feedback?: any;
}

export const createFeedback = async (feedbackData: FeedbackData): Promise<FeedbackResult> => {
  try {
    // Obter o usuário atual
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'Usuário não autenticado'
      };
    }

    // Inserir o feedback na tabela
    const { data, error } = await supabase
      .from('feedback_usuario')
      .insert({
        user_id: user.id,
        tipo: feedbackData.tipo,
        titulo: feedbackData.titulo,
        descricao: feedbackData.descricao
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar feedback:', error);
      return {
        success: false,
        error: 'Erro ao salvar feedback. Tente novamente.'
      };
    }

    return {
      success: true,
      feedback: data
    };
  } catch (error) {
    console.error('Erro geral ao criar feedback:', error);
    return {
      success: false,
      error: 'Erro de conexão. Tente novamente.'
    };
  }
};

export const getFeedbackByUser = async (): Promise<FeedbackResult> => {
  try {
    // Obter o usuário atual
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'Usuário não autenticado'
      };
    }

    // Buscar feedbacks do usuário
    const { data, error } = await supabase
      .from('feedback_usuario')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar feedbacks:', error);
      return {
        success: false,
        error: 'Erro ao carregar feedbacks'
      };
    }

    return {
      success: true,
      feedback: data
    };
  } catch (error) {
    console.error('Erro geral ao buscar feedbacks:', error);
    return {
      success: false,
      error: 'Erro de conexão'
    };
  }
};
