import { supabase } from '../../lib/supabase';
import { assertArtistTeamSlot } from './userService';

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
export const getCollaborators = async (artistId: string): Promise<{ 
  collaborators: Collaborator[] | null; 
  userRole: string | null;
  canManage: boolean;
  canAddCollaborators: boolean;
  collaboratorPlanBlockedMessage: string | null;
  error: string | null 
}> => {
  try {
    // Verificar se o usuário atual é membro do artista
    const { data: currentUser } = await supabase.auth.getUser();
    if (!currentUser.user) {
      return {
        collaborators: null,
        userRole: null,
        canManage: false,
        canAddCollaborators: false,
        collaboratorPlanBlockedMessage: null,
        error: 'Usuário não autenticado',
      };
    }

    const { data: userMembership, error: membershipError } = await supabase
      .from('artist_members')
      .select('user_id, role')
      .eq('artist_id', artistId)
      .eq('user_id', currentUser.user.id)
      .single();

    if (membershipError || !userMembership) {
      return {
        collaborators: null,
        userRole: null,
        canManage: false,
        canAddCollaborators: false,
        collaboratorPlanBlockedMessage: null,
        error: 'Usuário não tem acesso a este artista',
      };
    }

    // Verificar se o usuário pode gerenciar colaboradores (apenas owner e admin)
    const canManage = ['owner', 'admin'].includes(userMembership.role);
    
    // Verificar se o usuário pode adicionar colaboradores (apenas owner e admin)
    const canAddCollaborators = ['owner', 'admin'].includes(userMembership.role);

    // Buscar todos os colaboradores do artista
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
      return {
        collaborators: null,
        userRole: null,
        canManage: false,
        canAddCollaborators: false,
        collaboratorPlanBlockedMessage: null,
        error: error.message,
      };
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

    let canAddCollaboratorsFinal = canAddCollaborators;
    let collaboratorPlanBlockedMessage: string | null = null;
    if (canAddCollaborators) {
      const planSlot = await assertArtistTeamSlot(artistId, 'send_invite');
      if (!planSlot.error && !planSlot.ok && planSlot.userMessage) {
        canAddCollaboratorsFinal = false;
        collaboratorPlanBlockedMessage = planSlot.userMessage;
      }
    }

    return { 
      collaborators, 
      userRole: userMembership.role,
      canManage,
      canAddCollaborators: canAddCollaboratorsFinal,
      collaboratorPlanBlockedMessage,
      error: null 
    };
  } catch (error) {
    return {
      collaborators: null,
      userRole: null,
      canManage: false,
      canAddCollaborators: false,
      collaboratorPlanBlockedMessage: null,
      error: 'Erro de conexão',
    };
  }
};

export interface UsuarioBuscaColaborador {
  id: string;
  name: string;
  email: string;
  profile_url?: string | null;
  artist_display_name?: string;
  musical_style?: string | null;
  whatsapp?: string | null;
  city?: string | null;
  state?: string | null;
  work_roles?: unknown;
  show_formats?: unknown;
}

/** Busca contas para convite (RPC): qualquer usuário, exceto já vinculado ao artista e exceto você. */
export const searchUsersForCollaboratorInvite = async (
  searchTerm: string,
  artistId: string
): Promise<{ users: UsuarioBuscaColaborador[] | null; error: string | null }> => {
  try {
    const { data, error } = await supabase.rpc('buscar_usuarios_para_convite_colaborador', {
      p_termo: searchTerm?.trim() || '',
      p_artista_id: artistId,
    });
    if (error) {
      console.error('searchUsersForCollaboratorInvite:', error.message);
      return { users: null, error: error.message };
    }
    const rows = (data as Record<string, unknown>[]) || [];
    const users: UsuarioBuscaColaborador[] = rows.map((row) => ({
      id: String(row.user_id),
      name: String(row.name ?? ''),
      email: String(row.email ?? ''),
      profile_url: (row.artist_image_url as string) || (row.profile_url as string) || null,
      artist_display_name: row.artist_display_name != null ? String(row.artist_display_name) : undefined,
      musical_style: row.musical_style != null ? String(row.musical_style) : null,
      whatsapp: row.whatsapp != null ? String(row.whatsapp) : null,
      city: row.city != null ? String(row.city) : null,
      state: row.state != null ? String(row.state) : null,
      work_roles: row.work_roles,
      show_formats: row.show_formats,
    }));
    return { users, error: null };
  } catch (e) {
    console.error('searchUsersForCollaboratorInvite:', e);
    return { users: null, error: 'Erro de conexão' };
  }
};

// Buscar usuários por nome ou email
export const searchUsers = async (searchTerm: string): Promise<{ users: any[] | null; error: string | null }> => {
  try {
    console.log('🔍 Buscando usuários com termo:', searchTerm);
    
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, profile_url, city, state')
      .or(`email.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`)
      .limit(10);

    console.log('📊 Resultado da busca:', { 
      encontrados: data?.length || 0, 
      usuarios: data,
      erro: error 
    });

    if (error) {
      console.error('❌ Erro na busca:', error);
      return { users: null, error: error.message };
    }

    return { users: data || [], error: null };
  } catch (error) {
    console.error('❌ Erro de conexão na busca:', error);
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
    // Verificar se o usuário atual tem permissão para adicionar colaboradores
    const { data: currentUser } = await supabase.auth.getUser();
    if (!currentUser.user) {
      return { success: false, error: 'Usuário não autenticado' };
    }

    const { data: userMembership, error: membershipError } = await supabase
      .from('artist_members')
      .select('role')
      .eq('artist_id', artistId)
      .eq('user_id', currentUser.user.id)
      .single();

    if (membershipError || !userMembership) {
      return { success: false, error: 'Usuário não tem acesso a este artista' };
    }

    // Verificar se o usuário é owner ou admin (editors não podem adicionar)
    if (!['owner', 'admin'].includes(userMembership.role)) {
      return { success: false, error: 'Apenas proprietários e administradores podem adicionar colaboradores' };
    }

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

    const teamSlot = await assertArtistTeamSlot(artistId, 'add_member');
    if (teamSlot.error) {
      return { success: false, error: teamSlot.error };
    }
    if (!teamSlot.ok) {
      return { success: false, error: teamSlot.userMessage || 'Limite do plano gratuito atingido para este artista.' };
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

// Sair do artista (remover a si mesmo)
export const leaveArtist = async (artistId: string): Promise<{ success: boolean; error: string | null }> => {
  try {
    console.log('🚪 leaveArtist: Iniciando saída do artista:', artistId);
    
    // Verificar se o usuário está autenticado
    const { data: currentUser } = await supabase.auth.getUser();
    if (!currentUser.user) {
      console.error('❌ leaveArtist: Usuário não autenticado');
      return { success: false, error: 'Usuário não autenticado' };
    }

    console.log('👤 leaveArtist: Usuário atual:', currentUser.user.id);

    // Verificar se o usuário é membro antes de tentar remover
    const { data: checkMember, error: checkError } = await supabase
      .from('artist_members')
      .select('user_id, role')
      .eq('user_id', currentUser.user.id)
      .eq('artist_id', artistId)
      .single();

    if (checkError || !checkMember) {
      console.error('❌ leaveArtist: Usuário não é membro deste artista:', checkError);
      return { success: false, error: 'Você não é membro deste artista' };
    }

    console.log('✅ leaveArtist: Usuário é membro com role:', checkMember.role);

    // Remover o próprio usuário do artista
    console.log('🗑️ leaveArtist: Tentando remover usuário...');
    const { data: deleteData, error: deleteError } = await supabase
      .from('artist_members')
      .delete()
      .eq('user_id', currentUser.user.id)
      .eq('artist_id', artistId)
      .select();

    if (deleteError) {
      console.error('❌ leaveArtist: Erro ao deletar:', deleteError);
      return { success: false, error: deleteError.message };
    }

    console.log('✅ leaveArtist: Usuário removido com sucesso!', deleteData);
    return { success: true, error: null };
  } catch (error) {
    console.error('❌ leaveArtist: Erro inesperado:', error);
    return { success: false, error: 'Erro de conexão' };
  }
};

// Remover colaborador (por um admin/owner)
export const removeCollaborator = async (userId: string, artistId: string): Promise<{ success: boolean; error: string | null }> => {
  try {
    // Verificar se o usuário atual tem permissão para remover colaboradores
    const { data: currentUser } = await supabase.auth.getUser();
    if (!currentUser.user) {
      return { success: false, error: 'Usuário não autenticado' };
    }

    // ✅ Não pode remover a si mesmo usando esta função
    if (userId === currentUser.user.id) {
      return { success: false, error: 'Você não pode se remover desta forma. Use a opção "Sair do Artista"' };
    }

    const { data: userMembership, error: membershipError } = await supabase
      .from('artist_members')
      .select('role')
      .eq('artist_id', artistId)
      .eq('user_id', currentUser.user.id)
      .single();

    if (membershipError || !userMembership) {
      return { success: false, error: 'Usuário não tem acesso a este artista' };
    }

    // Verificar se o usuário pode remover colaboradores (apenas owner e admin)
    if (!['owner', 'admin'].includes(userMembership.role)) {
      return { success: false, error: 'Apenas proprietários e administradores podem remover colaboradores' };
    }

    // ✅ Buscar role do alvo para validar hierarquia
    const { data: targetMember, error: targetError } = await supabase
      .from('artist_members')
      .select('role')
      .eq('artist_id', artistId)
      .eq('user_id', userId)
      .single();

    if (targetError || !targetMember) {
      return { success: false, error: 'Colaborador não encontrado' };
    }

    // ✅ Se você é OWNER, não pode remover ADMIN
    if (userMembership.role === 'owner' && targetMember.role === 'admin') {
      return { success: false, error: 'Proprietários não podem remover administradores' };
    }
    
    // ✅ ADMIN pode remover TODOS (inclusive owner)
    // ✅ OWNER pode remover todos EXCETO admin

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
    console.log('🔵 Iniciando updateCollaboratorRole:', { userId, artistId, newRole });
    
    // Verificar se o usuário atual tem permissão para atualizar roles
    const { data: currentUser } = await supabase.auth.getUser();
    console.log('👤 Current User:', currentUser.user?.id);
    
    if (!currentUser.user) {
      console.error('❌ Usuário não autenticado');
      return { success: false, error: 'Usuário não autenticado' };
    }

    // ✅ Não pode alterar a própria role
    if (userId === currentUser.user.id) {
      console.error('❌ Tentando alterar própria role');
      return { success: false, error: 'Você não pode alterar suas próprias permissões' };
    }

    console.log('🔍 Buscando membership do usuário atual...');
    const { data: userMembership, error: membershipError } = await supabase
      .from('artist_members')
      .select('role')
      .eq('artist_id', artistId)
      .eq('user_id', currentUser.user.id)
      .single();

    console.log('📋 Membership do usuário atual:', { userMembership, membershipError });

    if (membershipError || !userMembership) {
      console.error('❌ Usuário não tem acesso a este artista:', membershipError);
      return { success: false, error: 'Usuário não tem acesso a este artista' };
    }

    // Verificar se o usuário pode atualizar roles (apenas owner e admin)
    if (!['owner', 'admin'].includes(userMembership.role)) {
      return { success: false, error: 'Apenas proprietários e administradores podem atualizar roles' };
    }

    // ✅ Buscar role do alvo para validar hierarquia
    const { data: targetMember, error: targetError } = await supabase
      .from('artist_members')
      .select('role')
      .eq('artist_id', artistId)
      .eq('user_id', userId)
      .single();

    if (targetError || !targetMember) {
      return { success: false, error: 'Colaborador não encontrado' };
    }

    // ✅ Se você é OWNER, não pode alterar permissões de ADMIN
    if (userMembership.role === 'owner' && targetMember.role === 'admin') {
      return { success: false, error: 'Proprietários não podem alterar permissões de administradores' };
    }
    
    // ✅ ADMIN pode alterar permissões de TODOS (inclusive owner)
    // ✅ OWNER pode alterar permissões de todos EXCETO admin

    console.log('🔄 Atualizando role:', {
      userId,
      artistId,
      currentRole: targetMember.role,
      newRole,
      userRole: userMembership.role
    });

    const { data, error } = await supabase
      .from('artist_members')
      .update({
        role: newRole,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('artist_id', artistId)
      .select();

    console.log('✅ Resultado do UPDATE:', { data, error });

    if (error) {
      console.error('❌ Erro ao atualizar role:', error);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      console.error('⚠️ UPDATE não afetou nenhuma linha');
      return { success: false, error: 'Nenhuma linha foi atualizada. Verifique as políticas RLS.' };
    }

    console.log('✅ Role atualizada com sucesso:', data);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Adicionar colaborador via convite (sem verificação de permissão)
export const addCollaboratorViaInvite = async (artistId: string, collaboratorData: AddCollaboratorData): Promise<{ success: boolean; error: string | null }> => {
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

    const teamSlot = await assertArtistTeamSlot(artistId, 'add_member');
    if (teamSlot.error) {
      return { success: false, error: teamSlot.error };
    }
    if (!teamSlot.ok) {
      return { success: false, error: teamSlot.userMessage || 'Limite do plano gratuito atingido para este artista.' };
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
