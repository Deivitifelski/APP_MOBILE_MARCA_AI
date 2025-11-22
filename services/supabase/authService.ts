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
  } catch {
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
  } catch {
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
  } catch {
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
  } catch {
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

export const resendConfirmationEmail = async (email: string): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('resendConfirmationEmail: Reenviando email de confirmação');
    
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
    });

    if (error) {
      console.log('resendConfirmationEmail: Erro do Supabase:', error.message);
      return {
        success: false,
        error: getErrorMessage(error.message)
      };
    }

    console.log('resendConfirmationEmail: Email reenviado com sucesso');
    return { success: true };
  } catch (error) {
    console.log('resendConfirmationEmail: Erro inesperado:', error);
    return {
      success: false,
      error: 'Erro de conexão. Tente novamente.'
    };
  }
};

export const sendPasswordResetEmail = async (email: string): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('🔵 [Reset Password] Enviando email de recuperação para:', email);
    
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: 'marcaai://auth/callback',
      }
    );

    if (error) {
      console.log('❌ [Reset Password] Erro do Supabase:', error.message);
      return {
        success: false,
        error: getErrorMessage(error.message)
      };
    }

    console.log('✅ [Reset Password] Email de recuperação enviado com sucesso');
    return { success: true };
  } catch (error) {
    console.log('❌ [Reset Password] Erro inesperado:', error);
    return {
      success: false,
      error: 'Erro de conexão. Tente novamente.'
    };
  }
};


export const deleteAccount = async (): Promise<{ success: boolean; error?: string; log?: string }> => {
  try {
    const { user, error: userError } = await getCurrentUser();

    if (userError || !user) {
      return { success: false, error: 'Usuário não autenticado' };
    }

    const { data, error } = await supabase.rpc('delete_user_account', {
      p_uid: user.id,
    });

    if (error) {
      console.error('deleteAccount rpc error', error);
      return { success: false, error: error.message };
    }

    const response = (data as Record<string, any> | null) ?? null;

    if (!response) {
      return { success: false, error: 'Resposta vazia do servidor.', log: 'Resposta vazia do servidor.' };
    }

    const statusValue = response.status;
    let status = '';

    if (typeof statusValue === 'string') {
      status = statusValue.toLowerCase();
    } else if (typeof statusValue === 'number') {
      status = String(statusValue).toLowerCase();
    } else if (statusValue) {
      status = String(statusValue).toLowerCase();
    }

    const responseError = (response.error || response.message) as string | undefined;

    if (status === 'error' || responseError) {
      const message = responseError || 'Erro desconhecido ao excluir a conta.';
      return { success: false, error: message, log: JSON.stringify(response, null, 2) };
    }

    const logMessage = JSON.stringify(response, null, 2);
    return { success: true, log: logMessage };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Erro de conexão. Tente novamente.',
      log: err?.message || 'Erro inesperado',
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
