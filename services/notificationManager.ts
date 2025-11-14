import { supabase } from '../lib/supabase';
import { createNotification } from './supabase/notificationService';

// Criar notificação automática para convites de artista (centralizado na tabela notifications)
export const createArtistInviteNotification = async (
  inviteId: string, // Não usado mais, mantido para compatibilidade
  toUserId: string,
  fromUserId: string,
  artistId: string,
  role?: 'viewer' | 'editor' | 'admin' | 'owner' // Role que será atribuída
): Promise<{ success: boolean; error: string | null; notification?: any }> => {
  try {
    // Buscar informações do artista e usuário remetente
    const { data: artistData } = await supabase
      .from('artists')
      .select('name')
      .eq('id', artistId)
      .single();

    const { data: fromUserData } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', fromUserId)
      .single();

    const artistName = artistData?.name || 'Artista';
    const fromUserName = fromUserData?.name || 'Alguém';

    // Criar notificação diretamente na tabela notifications com status 'pending'
    const { success, error, notification } = await createNotification({
      to_user_id: toUserId,
      from_user_id: fromUserId,
      artist_id: artistId,
      role: role || 'viewer', // ✅ Salvar a role do convite
      title: 'Novo Convite de Artista',
      message: `${fromUserName} te convidou para ser colaborador do artista "${artistName}"`,
      type: 'invite',
      status: 'pending' // ✅ Status inicial do convite
    });

    if (success && notification) {
      console.log('notificationManager: Notificação de convite criada com sucesso');
      return { success: true, error: null, notification };
    } else {
      console.error('notificationManager: Erro ao criar notificação de convite:', error);
      return { success: false, error: error || 'Erro ao criar notificação' };
    }
  } catch (error) {
    console.error('notificationManager: Erro ao criar notificação de convite:', error);
    return { success: false, error: 'Erro interno ao criar notificação' };
  }
};

// Criar notificação para quando um colaborador é adicionado
export const createCollaboratorAddedNotification = async (
  userId: string,
  artistId: string,
  addedByUserId: string
) => {
  try {
    const { data: artistData } = await supabase
      .from('artists')
      .select('name')
      .eq('id', artistId)
      .single();

    const { data: addedByUserData } = await supabase
      .from('users')
      .select('name')
      .eq('id', addedByUserId)
      .single();

    const artistName = artistData?.name || 'Artista';
    const addedByName = addedByUserData?.name || 'Alguém';

    const { success, error } = await createNotification({
      to_user_id: userId,
      from_user_id: addedByUserId,
      artist_id: artistId,
      title: 'Você foi adicionado como colaborador',
      message: `${addedByName} te adicionou como colaborador do artista "${artistName}"`,
      type: 'collaborator_added'
    });

    if (success) {
      console.log('notificationManager: Notificação de colaborador adicionado criada');
    } else {
      console.error('notificationManager: Erro ao criar notificação de colaborador:', error);
    }
  } catch (error) {
    console.error('notificationManager: Erro ao criar notificação de colaborador:', error);
  }
};

// Criar notificação para quando um colaborador é removido
export const createCollaboratorRemovedNotification = async (
  userId: string,
  artistId: string,
  removedByUserId: string
) => {
  try {
    const { data: artistData } = await supabase
      .from('artists')
      .select('name')
      .eq('id', artistId)
      .single();

    const { data: removedByUserData } = await supabase
      .from('users')
      .select('name')
      .eq('id', removedByUserId)
      .single();

    const artistName = artistData?.name || 'Artista';
    const removedByName = removedByUserData?.name || 'Alguém';

    const { success, error } = await createNotification({
      to_user_id: userId,
      from_user_id: removedByUserId,
      artist_id: artistId,
      title: 'Você foi removido do artista',
      message: `${removedByName} te removeu do artista "${artistName}"`,
      type: 'collaborator_removed'
    });

    if (success) {
      console.log('notificationManager: Notificação de colaborador removido criada');
    } else {
      console.error('notificationManager: Erro ao criar notificação de remoção:', error);
    }
  } catch (error) {
    console.error('notificationManager: Erro ao criar notificação de remoção:', error);
  }
};

// Notificar colaboradores sobre evento criado/atualizado (EXCETO quem criou)
export const notifyCollaboratorsAboutEvent = async (
  eventId: string,
  artistId: string,
  eventName: string,
  createdByUserId: string,
  type: 'created' | 'updated'
) => {
  try {
    // Buscar nome do artista
    const { data: artistData } = await supabase
      .from('artists')
      .select('name')
      .eq('id', artistId)
      .single();

    const artistName = artistData?.name || 'Artista';

    // Buscar nome de quem criou/editou
    const { data: creatorData } = await supabase
      .from('users')
      .select('name')
      .eq('id', createdByUserId)
      .single();

    const creatorName = creatorData?.name || 'Alguém';
    const action = type === 'created' ? 'criou' : 'atualizou';

    // Buscar TODOS os colaboradores do artista EXCETO quem criou/editou
    const { data: members } = await supabase
      .from('artist_members')
      .select('user_id')
      .eq('artist_id', artistId)
      .neq('user_id', createdByUserId); // ✅ EXCLUIR quem criou/editou

    if (!members || members.length === 0) {
      console.log(`notificationManager: Nenhum colaborador para notificar sobre evento ${type}`);
      return;
    }

    console.log(`notificationManager: Notificando ${members.length} colaboradores sobre evento ${type}`);

    // Criar notificação para cada colaborador
    const notificationPromises = members.map(member =>
      createNotification({
        to_user_id: member.user_id,
        from_user_id: createdByUserId,
        event_id: eventId,
        artist_id: artistId,
        title: `Evento ${type === 'created' ? 'criado' : 'atualizado'}`,
        message: `${creatorName} ${action} o evento "${eventName}" em "${artistName}"`,
        type: `event`
      })
    );

    await Promise.all(notificationPromises);
    console.log(`notificationManager: Notificações de evento ${type} enviadas com sucesso`);
  } catch (error) {
    console.error(`notificationManager: Erro ao notificar colaboradores sobre evento:`, error);
  }
};
