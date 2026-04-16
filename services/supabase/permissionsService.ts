import { supabase } from '../../lib/supabase';

/** Papéis em `artist_members`: admin, editor e viewer. */
export type UserRole = 'viewer' | 'editor' | 'admin';

export function normalizeArtistMemberRole(role: string): UserRole {
  if (role === 'viewer' || role === 'editor' || role === 'admin') return role;
  return 'viewer';
}

export interface UserPermission {
  userId: string;
  artistId: string;
  role: UserRole;
  permissions: {
    canViewEvents: boolean;
    canViewFinancials: boolean;
    canCreateEvents: boolean;
    canEditEvents: boolean;
    canDeleteEvents: boolean;
    canManageMembers: boolean;
    canManageArtist: boolean;
    canDeleteArtist: boolean;
  };
}

// Cache de permissões para evitar múltiplas consultas
const permissionsCache = new Map<string, UserPermission>();

// Função para obter permissões do usuário para um artista específico
export const getUserPermissions = async (userId: string, artistId: string): Promise<UserPermission | null> => {
  const cacheKey = `${userId}-${artistId}`;
  
  // Verificar cache primeiro
  if (permissionsCache.has(cacheKey)) {
    return permissionsCache.get(cacheKey)!;
  }

  try {
    console.log('🔍 permissionsService: Buscando permissões', { userId, artistId });
    
    const { data, error } = await supabase
      .from('artist_members')
      .select('role')
      .eq('user_id', userId)
      .eq('artist_id', artistId)
      .single();

    console.log('🔍 permissionsService: Resultado da query', { data, error });

    if (error) {
      console.error('❌ permissionsService: Erro na query:', error);
      return null;
    }
    
    if (!data) {
      console.log('⚠️ permissionsService: Nenhum dado encontrado');
      return null;
    }

    const role = normalizeArtistMemberRole(String(data.role));
    console.log('✅ permissionsService: Role encontrado:', role);
    
    const permissions = getUserPermissionsByRole(role);

    const userPermission: UserPermission = {
      userId,
      artistId,
      role,
      permissions
    };

    // Armazenar no cache
    permissionsCache.set(cacheKey, userPermission);
    
    return userPermission;
  } catch (error) {
    console.error('❌ Erro ao buscar permissões do usuário:', error);
    return null;
  }
};

// Função para obter permissões baseadas no role
export const getUserPermissionsByRole = (role: UserRole) => {
  switch (role) {
    case 'viewer':
      return {
        canViewEvents: true,
        canViewFinancials: false,
        canCreateEvents: false,
        canEditEvents: false,
        canDeleteEvents: false,
        canManageMembers: false,
        canManageArtist: false,
        canDeleteArtist: false,
      };
    
    case 'editor':
      return {
        canViewEvents: true,
        canViewFinancials: true,
        canCreateEvents: true,
        canEditEvents: true,
        canDeleteEvents: false,
        canManageMembers: false,
        canManageArtist: false,
        canDeleteArtist: false,
      };
    
    case 'admin':
      return {
        canViewEvents: true,
        canViewFinancials: true,
        canCreateEvents: true,
        canEditEvents: true,
        canDeleteEvents: true,
        canManageMembers: true,
        canManageArtist: true,
        canDeleteArtist: true, // Admin pode deletar artista
      };
    
    default:
      return {
        canViewEvents: false,
        canViewFinancials: false,
        canCreateEvents: false,
        canEditEvents: false,
        canDeleteEvents: false,
        canManageMembers: false,
        canManageArtist: false,
        canDeleteArtist: false,
      };
  }
};

// Função para verificar se o usuário tem uma permissão específica
export const hasPermission = async (
  userId: string, 
  artistId: string, 
  permission: keyof UserPermission['permissions']
): Promise<boolean> => {
  const userPermission = await getUserPermissions(userId, artistId);
  return userPermission?.permissions[permission] || false;
};

// Função para limpar cache de permissões
export const clearPermissionsCache = (userId?: string, artistId?: string) => {
  if (userId && artistId) {
    const cacheKey = `${userId}-${artistId}`;
    permissionsCache.delete(cacheKey);
  } else {
    permissionsCache.clear();
  }
};

// Função para obter todos os artistas que o usuário tem acesso
export const getUserArtists = async (userId: string): Promise<{artistId: string, role: UserRole}[] | null> => {
  try {
    const { data, error } = await supabase
      .from('artist_members')
      .select('artist_id, role')
      .eq('user_id', userId);

    if (error) {
      console.error('Erro ao buscar artistas do usuário:', error);
      return null;
    }

    return data.map(item => ({
      artistId: item.artist_id,
      role: normalizeArtistMemberRole(String(item.role)),
    }));
  } catch (error) {
    console.error('Erro ao buscar artistas do usuário:', error);
    return null;
  }
};

/** Administrador em pelo menos um artista. */
export const isUserAdmin = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('artist_members')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .limit(1);

    if (error) {
      console.error('Erro ao verificar se usuário é admin:', error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error('Erro ao verificar se usuário é admin:', error);
    return false;
  }
};

/** @deprecated Use `isUserAdmin`. */
export const isUserOwner = isUserAdmin;
