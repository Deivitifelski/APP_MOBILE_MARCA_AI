import { supabase } from '../../lib/supabase';
import { addCollaborator } from './collaboratorService';

// Aceitar convite de colaborador
export const acceptCollaboratorInvite = async (notificationId: string): Promise<{ success: boolean; error: string | null }> => {
  try {
    // Primeiro, buscar os dados da notificação
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .select(`
        *,
        from_user:users!from_user_id(id, name, email),
        artist:artists(id, name)
      `)
      .eq('id', notificationId)
      .eq('type', 'collaborator_invite')
      .single();

    if (notificationError || !notification) {
      return { success: false, error: 'Convite não encontrado' };
    }

    // Verificar se o convite ainda é válido (não foi aceito/recusado antes)
    if (!notification.artist_id || !notification.from_user_id) {
      return { success: false, error: 'Dados do convite inválidos' };
    }

    // Extrair o role da mensagem (admin, editor, viewer)
    const roleMatch = notification.message.match(/como (admin|editor|viewer)/i);
    const role = roleMatch ? roleMatch[1].toLowerCase() as 'admin' | 'editor' | 'viewer' : 'viewer';

    // Adicionar como colaborador
    const { success: addSuccess, error: addError } = await addCollaborator(notification.artist_id, {
      userId: notification.user_id,
      role: role
    });

    if (!addSuccess) {
      return { success: false, error: addError || 'Erro ao aceitar convite' };
    }

    // Marcar notificação como lida e atualizar o tipo
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ 
        read: true,
        type: 'collaborator_invite_accepted'
      })
      .eq('id', notificationId);

    if (updateError) {
      console.error('Erro ao atualizar notificação:', updateError);
      // Não falha a operação principal se não conseguir atualizar a notificação
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Recusar convite de colaborador
export const rejectCollaboratorInvite = async (notificationId: string): Promise<{ success: boolean; error: string | null }> => {
  try {
    // Marcar notificação como lida e atualizar o tipo
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ 
        read: true,
        type: 'collaborator_invite_rejected'
      })
      .eq('id', notificationId)
      .eq('type', 'collaborator_invite');

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Buscar convites pendentes do usuário
export const getPendingInvites = async (userId: string): Promise<{ invites: any[] | null; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        from_user:users!from_user_id(id, name, email),
        artist:artists(id, name)
      `)
      .eq('user_id', userId)
      .eq('type', 'collaborator_invite')
      .eq('read', false)
      .order('created_at', { ascending: false });

    if (error) {
      return { invites: null, error: error.message };
    }

    return { invites: data || [], error: null };
  } catch (error) {
    return { invites: null, error: 'Erro de conexão' };
  }
};
