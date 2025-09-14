import { supabase } from '../../lib/supabase';

export interface Collaborator {
  user_id: string;
  artist_id: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    name: string;
    email: string;
    profile_url?: string;
  };
}

export interface AddCollaboratorData {
  userId: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
}

// Buscar colaboradores de um artista
export const getCollaborators = async (artistId: string): Promise<{ collaborators: Collaborator[] | null; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('artist_members')
      .select(`
        user_id,
        artist_id,
        role,
        created_at,
        updated_at,
        users (
          id,
          name,
          email,
          profile_url
        )
      `)
      .eq('artist_id', artistId)
      .order('created_at', { ascending: true });

    if (error) {
      return { collaborators: null, error: error.message };
    }

    // Transformar os dados para o formato esperado
    const collaborators = data?.map(item => ({
      user_id: item.user_id,
      artist_id: item.artist_id,
      role: item.role,
      created_at: item.created_at,
      updated_at: item.updated_at,
      user: {
        id: (item.users as any)?.id || '',
        name: (item.users as any)?.name || '',
        email: (item.users as any)?.email || '',
        profile_url: (item.users as any)?.profile_url
      }
    })) || [];

    return { collaborators, error: null };
  } catch (error) {
    return { collaborators: null, error: 'Erro de conexão' };
  }
};

// Buscar usuários por nome ou email
export const searchUsers = async (searchTerm: string): Promise<{ users: any[] | null; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .or(`email.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`)
      .limit(10);

    if (error) {
      return { users: null, error: error.message };
    }

    return { users: data || [], error: null };
  } catch (error) {
    return { users: null, error: 'Erro de conexão' };
  }
};

// Buscar usuário por email (mantido para compatibilidade)
export const getUserByEmail = async (email: string): Promise<{ user: any | null; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      return { user: null, error: error.message };
    }

    return { user: data, error: null };
  } catch (error) {
    return { user: null, error: 'Erro de conexão' };
  }
};

// Adicionar colaborador
export const addCollaborator = async (artistId: string, collaboratorData: AddCollaboratorData): Promise<{ success: boolean; error: string | null }> => {
  try {
    // Verificar se o usuário já é colaborador deste artista
    const { data: existingMember, error: checkError } = await supabase
      .from('artist_members')
      .select('user_id')
      .eq('artist_id', artistId)
      .eq('user_id', collaboratorData.userId)
      .single();

    if (existingMember) {
      return { success: false, error: 'Usuário já é colaborador deste artista' };
    }

    // Adicionar o colaborador
    const { error } = await supabase
      .from('artist_members')
      .insert({
        user_id: collaboratorData.userId,
        artist_id: artistId,
        role: collaboratorData.role,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Remover colaborador
export const removeCollaborator = async (userId: string, artistId: string): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase
      .from('artist_members')
      .delete()
      .eq('user_id', userId)
      .eq('artist_id', artistId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Atualizar role do colaborador
export const updateCollaboratorRole = async (userId: string, artistId: string, newRole: 'owner' | 'admin' | 'editor' | 'viewer'): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase
      .from('artist_members')
      .update({
        role: newRole,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('artist_id', artistId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Verificar se usuário é owner do artista
export const isUserOwner = async (userId: string, artistId: string): Promise<{ isOwner: boolean; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('artist_members')
      .select('role')
      .eq('user_id', userId)
      .eq('artist_id', artistId)
      .eq('role', 'owner')
      .single();

    if (error) {
      return { isOwner: false, error: error.message };
    }

    return { isOwner: !!data, error: null };
  } catch (error) {
    return { isOwner: false, error: 'Erro de conexão' };
  }
};
