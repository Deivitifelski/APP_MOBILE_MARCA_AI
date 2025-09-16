import { supabase } from '../../lib/supabase';
import { hasPermission, clearPermissionsCache } from './permissionsService';

export interface ArtistMember {
  id: string;
  artist_id: string;
  user_id: string;
  role: 'viewer' | 'editor' | 'admin' | 'owner';
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateMemberData {
  artist_id: string;
  user_id: string;
  role: 'viewer' | 'editor' | 'admin' | 'owner';
}

export interface UpdateMemberData {
  role: 'viewer' | 'editor' | 'admin' | 'owner';
}

// Buscar membros de um artista com verificação de permissões
export const getArtistMembers = async (artistId: string, userId: string): Promise<{ members: ArtistMember[] | null; error: string | null }> => {
  try {
    // Verificar se o usuário tem permissão para gerenciar membros
    const canManage = await hasPermission(userId, artistId, 'canManageMembers');
    if (!canManage) {
      return { members: null, error: 'Sem permissão para visualizar membros' };
    }

    const { data, error } = await supabase
      .from('artist_members')
      .select(`
        *,
        user:users(id, name, email)
      `)
      .eq('artist_id', artistId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar membros:', error);
      return { members: null, error: error.message };
    }

    return { members: data || [], error: null };
  } catch (error) {
    console.error('Erro ao buscar membros:', error);
    return { members: null, error: 'Erro ao buscar membros' };
  }
};

// Adicionar membro com verificação de permissões
export const addArtistMember = async (memberData: CreateMemberData, userId: string): Promise<{ success: boolean; error: string | null }> => {
  try {
    // Verificar se o usuário tem permissão para gerenciar membros
    const canManage = await hasPermission(userId, memberData.artist_id, 'canManageMembers');
    if (!canManage) {
      return { success: false, error: 'Sem permissão para adicionar membros' };
    }

    // Verificar se o usuário não está tentando adicionar um owner (apenas owners podem adicionar owners)
    if (memberData.role === 'owner') {
      const canManageArtist = await hasPermission(userId, memberData.artist_id, 'canManageArtist');
      if (!canManageArtist) {
        return { success: false, error: 'Apenas owners podem adicionar outros owners' };
      }
    }

    const { error } = await supabase
      .from('artist_members')
      .insert({
        artist_id: memberData.artist_id,
        user_id: memberData.user_id,
        role: memberData.role,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Erro ao adicionar membro:', error);
      return { success: false, error: error.message };
    }

    // Limpar cache de permissões
    clearPermissionsCache(memberData.user_id, memberData.artist_id);

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao adicionar membro:', error);
    return { success: false, error: 'Erro ao adicionar membro' };
  }
};

// Atualizar role de membro com verificação de permissões
export const updateMemberRole = async (memberId: string, memberData: UpdateMemberData, userId: string): Promise<{ success: boolean; error: string | null }> => {
  try {
    // Primeiro, buscar o membro para obter o artist_id
    const { data: member, error: fetchError } = await supabase
      .from('artist_members')
      .select('artist_id, user_id')
      .eq('id', memberId)
      .single();

    if (fetchError || !member) {
      return { success: false, error: 'Membro não encontrado' };
    }

    // Verificar se o usuário tem permissão para gerenciar membros
    const canManage = await hasPermission(userId, member.artist_id, 'canManageMembers');
    if (!canManage) {
      return { success: false, error: 'Sem permissão para editar membros' };
    }

    // Verificar se o usuário não está tentando promover alguém para owner (apenas owners podem)
    if (memberData.role === 'owner') {
      const canManageArtist = await hasPermission(userId, member.artist_id, 'canManageArtist');
      if (!canManageArtist) {
        return { success: false, error: 'Apenas owners podem promover outros para owner' };
      }
    }

    // Verificar se o usuário não está tentando alterar o próprio role para algo menor
    if (member.user_id === userId) {
      return { success: false, error: 'Você não pode alterar seu próprio role' };
    }

    const { error } = await supabase
      .from('artist_members')
      .update({
        role: memberData.role,
        updated_at: new Date().toISOString()
      })
      .eq('id', memberId);

    if (error) {
      console.error('Erro ao atualizar membro:', error);
      return { success: false, error: error.message };
    }

    // Limpar cache de permissões
    clearPermissionsCache(member.user_id, member.artist_id);

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao atualizar membro:', error);
    return { success: false, error: 'Erro ao atualizar membro' };
  }
};

// Remover membro com verificação de permissões
export const removeArtistMember = async (memberId: string, userId: string): Promise<{ success: boolean; error: string | null }> => {
  try {
    // Primeiro, buscar o membro para obter o artist_id
    const { data: member, error: fetchError } = await supabase
      .from('artist_members')
      .select('artist_id, user_id, role')
      .eq('id', memberId)
      .single();

    if (fetchError || !member) {
      return { success: false, error: 'Membro não encontrado' };
    }

    // Verificar se o usuário tem permissão para gerenciar membros
    const canManage = await hasPermission(userId, member.artist_id, 'canManageMembers');
    if (!canManage) {
      return { success: false, error: 'Sem permissão para remover membros' };
    }

    // Verificar se o usuário não está tentando remover o último owner
    if (member.role === 'owner') {
      const { data: owners, error: ownersError } = await supabase
        .from('artist_members')
        .select('id')
        .eq('artist_id', member.artist_id)
        .eq('role', 'owner');

      if (ownersError) {
        return { success: false, error: 'Erro ao verificar owners' };
      }

      if (owners && owners.length <= 1) {
        return { success: false, error: 'Não é possível remover o último owner do artista' };
      }
    }

    // Verificar se o usuário não está tentando remover a si mesmo
    if (member.user_id === userId) {
      return { success: false, error: 'Você não pode remover a si mesmo' };
    }

    const { error } = await supabase
      .from('artist_members')
      .delete()
      .eq('id', memberId);

    if (error) {
      console.error('Erro ao remover membro:', error);
      return { success: false, error: error.message };
    }

    // Limpar cache de permissões
    clearPermissionsCache(member.user_id, member.artist_id);

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao remover membro:', error);
    return { success: false, error: 'Erro ao remover membro' };
  }
};

// Buscar usuários disponíveis para adicionar como membros
export const getAvailableUsers = async (artistId: string, userId: string, searchTerm?: string): Promise<{ users: Array<{id: string, name: string, email: string}> | null; error: string | null }> => {
  try {
    // Verificar se o usuário tem permissão para gerenciar membros
    const canManage = await hasPermission(userId, artistId, 'canManageMembers');
    if (!canManage) {
      return { users: null, error: 'Sem permissão para gerenciar membros' };
    }

    // Buscar usuários que não são membros do artista
    let query = supabase
      .from('users')
      .select('id, name, email')
      .not('id', 'in', `(SELECT user_id FROM artist_members WHERE artist_id = '${artistId}')`);

    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query.limit(20);

    if (error) {
      console.error('Erro ao buscar usuários:', error);
      return { users: null, error: error.message };
    }

    return { users: data || [], error: null };
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    return { users: null, error: 'Erro ao buscar usuários' };
  }
};
