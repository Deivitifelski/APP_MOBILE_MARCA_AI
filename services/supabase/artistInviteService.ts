import { supabase } from '../../lib/supabase';

export interface ArtistInvite {
  id: string;
  artist_id: string;
  from_user_id: string;
  to_user_id: string;
  status: 'pending' | 'accepted' | 'declined';
  read: boolean;
  created_at: string;
  responded_at?: string;
  artist?: {
    id: string;
    name: string;
  };
  from_user?: {
    id: string;
    name: string;
    email: string;
  };
  to_user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateInviteData {
  artistId: string;
  toUserId: string;
  fromUserId: string;
}

export interface InviteResponse {
  success: boolean;
  error?: string;
  invite?: ArtistInvite;
  invites?: ArtistInvite[];
}

// Criar convite para colaborar
export const createArtistInvite = async (data: CreateInviteData): Promise<InviteResponse> => {
  try {
    const { data: invite, error } = await supabase
      .from('artist_invites')
      .insert({
        artist_id: data.artistId,
        from_user_id: data.fromUserId,
        to_user_id: data.toUserId,
        status: 'pending',
        read: false
      })
      .select(`
        *,
        artist:artists(id, name),
        from_user:users!artist_invites_from_user_id_fkey(id, name, email),
        to_user:users!artist_invites_to_user_id_fkey(id, name, email)
      `)
      .single();

    if (error) {
      console.error('Erro ao criar convite:', error);
      return { success: false, error: error.message };
    }

    return { success: true, invite };
  } catch (error) {
    console.error('Erro ao criar convite:', error);
    return { success: false, error: 'Erro interno ao criar convite' };
  }
};

// Buscar convites recebidos por um usuário
export const getArtistInvitesReceived = async (userId: string): Promise<InviteResponse> => {
  try {
    const { data: invites, error } = await supabase
      .from('artist_invites')
      .select(`
        *,
        artist:artists(id, name),
        from_user:users!artist_invites_from_user_id_fkey(id, name, email)
      `)
      .eq('to_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar convites recebidos:', error);
      return { success: false, error: error.message };
    }

    return { success: true, invites: invites as ArtistInvite[] };
  } catch (error) {
    console.error('Erro ao buscar convites recebidos:', error);
    return { success: false, error: 'Erro interno ao buscar convites' };
  }
};

// Buscar convites enviados por um usuário
export const getArtistInvitesSent = async (userId: string): Promise<InviteResponse> => {
  try {
    const { data: invites, error } = await supabase
      .from('artist_invites')
      .select(`
        *,
        artist:artists(id, name),
        to_user:users!artist_invites_to_user_id_fkey(id, name, email)
      `)
      .eq('from_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar convites enviados:', error);
      return { success: false, error: error.message };
    }

    return { success: true, invites: invites as ArtistInvite[] };
  } catch (error) {
    console.error('Erro ao buscar convites enviados:', error);
    return { success: false, error: 'Erro interno ao buscar convites' };
  }
};

// Aceitar convite
export const acceptArtistInvite = async (inviteId: string, userId: string): Promise<InviteResponse> => {
  try {
    // Primeiro, buscar o convite para obter os dados
    const { data: invite, error: fetchError } = await supabase
      .from('artist_invites')
      .select('*')
      .eq('id', inviteId)
      .eq('to_user_id', userId)
      .eq('status', 'pending')
      .single();

    if (fetchError || !invite) {
      return { success: false, error: 'Convite não encontrado ou já processado' };
    }

    // Atualizar o status do convite
    const { data: updatedInvite, error: updateError } = await supabase
      .from('artist_invites')
      .update({
        status: 'accepted',
        responded_at: new Date().toISOString()
      })
      .eq('id', inviteId)
      .select(`
        *,
        artist:artists(id, name),
        from_user:users!artist_invites_from_user_id_fkey(id, name, email),
        to_user:users!artist_invites_to_user_id_fkey(id, name, email)
      `)
      .single();

    if (updateError) {
      console.error('Erro ao aceitar convite:', updateError);
      return { success: false, error: updateError.message };
    }

    // Adicionar como colaborador com role padrão (viewer)
    const { addCollaborator } = await import('./collaboratorService');
    const { success: addSuccess, error: addError } = await addCollaborator(
      invite.artist_id, 
      { userId: invite.to_user_id, role: 'viewer' }
    );

    if (!addSuccess) {
      console.error('Erro ao adicionar colaborador:', addError);
      // Reverter o status do convite
      await supabase
        .from('artist_invites')
        .update({ status: 'pending' })
        .eq('id', inviteId);
      return { success: false, error: addError || 'Erro ao adicionar colaborador' };
    }

    return { success: true, invite: updatedInvite };
  } catch (error) {
    console.error('Erro ao aceitar convite:', error);
    return { success: false, error: 'Erro interno ao aceitar convite' };
  }
};

// Recusar convite
export const declineArtistInvite = async (inviteId: string, userId: string): Promise<InviteResponse> => {
  try {
    const { data: invite, error } = await supabase
      .from('artist_invites')
      .update({
        status: 'declined',
        responded_at: new Date().toISOString()
      })
      .eq('id', inviteId)
      .eq('to_user_id', userId)
      .eq('status', 'pending')
      .select(`
        *,
        artist:artists(id, name),
        from_user:users!artist_invites_from_user_id_fkey(id, name, email),
        to_user:users!artist_invites_to_user_id_fkey(id, name, email)
      `)
      .single();

    if (error) {
      console.error('Erro ao recusar convite:', error);
      return { success: false, error: error.message };
    }

    if (!invite) {
      return { success: false, error: 'Convite não encontrado ou já processado' };
    }

    return { success: true, invite };
  } catch (error) {
    console.error('Erro ao recusar convite:', error);
    return { success: false, error: 'Erro interno ao recusar convite' };
  }
};

// Marcar convite como lido
export const markInviteAsRead = async (inviteId: string, userId: string): Promise<InviteResponse> => {
  try {
    const { data: invite, error } = await supabase
      .from('artist_invites')
      .update({ read: true })
      .eq('id', inviteId)
      .eq('to_user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Erro ao marcar convite como lido:', error);
      return { success: false, error: error.message };
    }

    return { success: true, invite };
  } catch (error) {
    console.error('Erro ao marcar convite como lido:', error);
    return { success: false, error: 'Erro interno ao marcar convite como lido' };
  }
};

// Cancelar convite (apenas o remetente pode cancelar)
export const cancelArtistInvite = async (inviteId: string, fromUserId: string): Promise<InviteResponse> => {
  try {
    const { data: invite, error } = await supabase
      .from('artist_invites')
      .delete()
      .eq('id', inviteId)
      .eq('from_user_id', fromUserId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) {
      console.error('Erro ao cancelar convite:', error);
      return { success: false, error: error.message };
    }

    return { success: true, invite };
  } catch (error) {
    console.error('Erro ao cancelar convite:', error);
    return { success: false, error: 'Erro interno ao cancelar convite' };
  }
};

// Verificar se já existe convite pendente
export const checkPendingInvite = async (artistId: string, toUserId: string): Promise<InviteResponse> => {
  try {
    const { data: invite, error } = await supabase
      .from('artist_invites')
      .select('*')
      .eq('artist_id', artistId)
      .eq('to_user_id', toUserId)
      .eq('status', 'pending')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Erro ao verificar convite pendente:', error);
      return { success: false, error: error.message };
    }

    return { success: true, invite: invite || null };
  } catch (error) {
    console.error('Erro ao verificar convite pendente:', error);
    return { success: false, error: 'Erro interno ao verificar convite' };
  }
};
