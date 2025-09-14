import { createNotification } from './supabase/notificationService';
import { supabase } from '../lib/supabase';

// Criar notificação automática para convites de artista
export const createArtistInviteNotification = async (
  inviteId: string,
  toUserId: string,
  fromUserId: string,
  artistId: string
) => {
  try {
    // Buscar informações do artista e usuário remetente
    const { data: artistData } = await supabase
      .from('artists')
      .select('name')
      .eq('id', artistId)
      .single();

    const { data: fromUserData } = await supabase
      .from('users')
      .select('name')
      .eq('id', fromUserId)
      .single();

    const artistName = artistData?.name || 'Artista';
    const fromUserName = fromUserData?.name || 'Alguém';

    // Criar notificação
    const { success, error } = await createNotification({
      user_id: toUserId,
      from_user_id: fromUserId,
      artist_id: artistId,
      title: 'Novo Convite de Artista',
      message: `${fromUserName} te convidou para ser colaborador do artista "${artistName}"`,
      type: 'artist_invite'
    });

    if (success) {
      console.log('notificationManager: Notificação de convite criada com sucesso');
    } else {
      console.error('notificationManager: Erro ao criar notificação de convite:', error);
    }
  } catch (error) {
    console.error('notificationManager: Erro ao criar notificação de convite:', error);
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
      user_id: userId,
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
      user_id: userId,
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

// Criar notificação para eventos criados/atualizados
export const createEventNotification = async (
  userId: string,
  eventId: string,
  artistId: string,
  eventName: string,
  type: 'created' | 'updated'
) => {
  try {
    const { data: artistData } = await supabase
      .from('artists')
      .select('name')
      .eq('id', artistId)
      .single();

    const artistName = artistData?.name || 'Artista';
    const action = type === 'created' ? 'criado' : 'atualizado';

    const { success, error } = await createNotification({
      user_id: userId,
      event_id: eventId,
      artist_id: artistId,
      title: `Evento ${action}`,
      message: `O evento "${eventName}" foi ${action} no artista "${artistName}"`,
      type: `event_${type}`
    });

    if (success) {
      console.log(`notificationManager: Notificação de evento ${type} criada`);
    } else {
      console.error(`notificationManager: Erro ao criar notificação de evento:`, error);
    }
  } catch (error) {
    console.error(`notificationManager: Erro ao criar notificação de evento:`, error);
  }
};
