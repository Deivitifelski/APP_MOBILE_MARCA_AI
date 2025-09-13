import { supabase } from '../../lib/supabase';

export interface LoginResult {
  data: {
    user: {
      id: string;
      email: string;
      email_confirmed_at: string | null;
    } | null;
    session: any;
  } | null;
  error: {
    message: string;
  } | null;
}

export const loginUser = async (email: string, password: string): Promise<LoginResult> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: password,
    });

    if (error) {
      return {
        data: null,
        error: {
          message: getErrorMessage(error.message),
        },
      };
    }

    return {
      data: {
        user: data.user ? {
          id: data.user.id,
          email: data.user.email || '',
          email_confirmed_at: data.user.email_confirmed_at || null,
        } : null,
        session: data.session,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: {
        message: 'Erro de conexão. Tente novamente.',
      },
    };
  }
};

export const logoutUser = async (): Promise<{ error: string | null }> => {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      return {
        error: 'Erro ao fazer logout',
      };
    }

    return {
      error: null,
    };
  } catch (error) {
    return {
      error: 'Erro de conexão',
    };
  }
};

export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      return { user: null, error: error.message };
    }

    return { user, error: null };
  } catch (error) {
    return { user: null, error: 'Erro de conexão' };
  }
};

export const getCurrentSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      return { session: null, error: error.message };
    }

    return { session, error: null };
  } catch (error) {
    return { session: null, error: 'Erro de conexão' };
  }
};

// Função para traduzir mensagens de erro do Supabase
const getErrorMessage = (errorMessage: string): string => {
  const errorMap: { [key: string]: string } = {
    'Invalid login credentials': 'Email ou senha incorretos',
    'Email not confirmed': 'Email não confirmado. Verifique sua caixa de entrada.',
    'Too many requests': 'Muitas tentativas. Tente novamente em alguns minutos.',
    'User not found': 'Usuário não encontrado',
    'Invalid email': 'Email inválido',
    'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres',
  };

  return errorMap[errorMessage] || errorMessage;
};
