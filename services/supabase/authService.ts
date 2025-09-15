import { supabase } from '../../lib/supabase';
import { clearActiveArtist } from '../artistContext';

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
    // Limpar artista ativo antes do logout
    await clearActiveArtist();
    console.log('authService: Artista ativo limpo no logout');
    
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

export const updatePassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('updatePassword: Iniciando alteração de senha');
    
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      console.log('updatePassword: Erro do Supabase:', error.message);
      return {
        success: false,
        error: getErrorMessage(error.message)
      };
    }

    console.log('updatePassword: Senha alterada com sucesso');
    return { success: true };
  } catch (error) {
    console.log('updatePassword: Erro inesperado:', error);
    return {
      success: false,
      error: 'Erro de conexão. Tente novamente.'
    };
  }
};

// Função para traduzir mensagens de erro do Supabase
const getErrorMessage = (errorMessage: string): string => {
  const errorMap: { [key: string]: string } = {
    // Mensagens de login
    'Invalid login credentials': 'Email ou senha incorretos',
    'Email not confirmed': 'Email não confirmado. Verifique sua caixa de entrada.',
    'Too many requests': 'Muitas tentativas. Tente novamente em alguns minutos.',
    'User not found': 'Usuário não encontrado',
    'Invalid email': 'Email inválido',
    
    // Mensagens de senha
    'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres',
    'New password should be different from the old password': 'A nova senha deve ser diferente da senha atual',
    'Password is too weak': 'A senha é muito fraca. Use uma senha mais forte',
    'Password should be at least 8 characters': 'A senha deve ter pelo menos 8 caracteres',
    'Password must contain at least one uppercase letter': 'A senha deve conter pelo menos uma letra maiúscula',
    'Password must contain at least one lowercase letter': 'A senha deve conter pelo menos uma letra minúscula',
    'Password must contain at least one number': 'A senha deve conter pelo menos um número',
    'Password must contain at least one special character': 'A senha deve conter pelo menos um caractere especial',
    'Password is too common': 'Esta senha é muito comum. Escolha uma senha mais única',
    'Password contains personal information': 'A senha não deve conter informações pessoais',
    'Password has been compromised': 'Esta senha foi comprometida. Escolha uma senha diferente',
    
    // Mensagens de autenticação
    'Invalid session': 'Sessão inválida. Faça login novamente',
    'Session expired': 'Sessão expirada. Faça login novamente',
    'User not authenticated': 'Usuário não autenticado',
    'Access token expired': 'Token de acesso expirado. Faça login novamente',
    'Refresh token expired': 'Token de renovação expirado. Faça login novamente',
    'Invalid refresh token': 'Token de renovação inválido',
    'Email rate limit exceeded': 'Limite de emails excedido. Tente novamente mais tarde',
    'Password rate limit exceeded': 'Limite de tentativas de senha excedido. Tente novamente mais tarde',
    
    // Mensagens de validação
    'Unable to validate email address: invalid format': 'Formato de email inválido',
    'Email address is already in use': 'Este email já está em uso',
    'Email address is not valid': 'Endereço de email inválido',
    'Invalid password format': 'Formato de senha inválido',
    'Password confirmation does not match': 'Confirmação de senha não confere',
    
    // Mensagens de sistema
    'Internal server error': 'Erro interno do servidor. Tente novamente',
    'Service temporarily unavailable': 'Serviço temporariamente indisponível',
    'Network error': 'Erro de rede. Verifique sua conexão',
    'Request timeout': 'Tempo limite da requisição excedido',
    'Database connection error': 'Erro de conexão com o banco de dados',
    'Authentication service unavailable': 'Serviço de autenticação indisponível',
  };

  return errorMap[errorMessage] || errorMessage;
};
