import { supabase } from '../../lib/supabase';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  city?: string;
  state?: string;
  phone?: string;
  profile_url?: string;
  plan_is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUserProfileData {
  id: string;
  name: string;
  email: string;
  city?: string;
  state?: string;
  phone?: string;
  profile_url?: string;
  plan_is_active?: boolean;
}

// Verificar se o usuário existe na tabela users
export const checkUserExists = async (userId: string): Promise<{ exists: boolean; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle(); // Usar maybeSingle() para evitar erro quando não encontrar

    if (error) {
      console.error('❌ checkUserExists: Erro na consulta:', error);
      return { exists: false, error: error.message };
    }

    const exists = data !== null;
    return { exists, error: null };
  } catch (error) {
    return { exists: false, error: 'Erro de conexão' };
  }
};

// Criar perfil do usuário
export const createUserProfile = async (userData: CreateUserProfileData): Promise<{ success: boolean; error: string | null }> => {
  try {
    // Buscar token FCM apenas ao criar novo usuário
    let tokenFCM: string | null = null;
    try {
      const { getFCMToken } = await import('../pushNotificationHandler');
      tokenFCM = await getFCMToken();
      if (tokenFCM) {
        console.log('🔑 Token FCM obtido com sucesso!');
      } else {
        console.log('⚠️ Token FCM não disponível ao criar usuário');
      }
    } catch (tokenError) {
      console.log('⚠️ Erro ao obter token FCM (continuando sem token):', tokenError);
      // Continua sem o token se houver erro
    }

    const { error } = await supabase
      .from('users')
      .insert({
        id: userData.id,
        name: userData.name,
        email: userData.email,
        city: userData.city || null,
        state: userData.state || null,
        phone: userData.phone || null,
        profile_url: userData.profile_url || null,
        plan_is_active: userData.plan_is_active || false,
        token_fcm: tokenFCM || null,
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

// Criar ou atualizar usuário com dados do Google
interface SocialUserData {
  name?: string;
  email: string;
  photo?: string | null;
}

const upsertSocialUserProfile = async (
  userId: string,
  socialData: SocialUserData
): Promise<{ success: boolean; error: string | null; isNewUser?: boolean }> => {
  try {
    const { exists, error: checkError } = await checkUserExists(userId);

    if (checkError) {
      console.error('❌ [Social User] Erro ao verificar usuário:', checkError);
      return { success: false, error: checkError };
    }

    if (exists) {
      // Usuário já existe: não sobrescrever dados. Apple só traz nome no primeiro login;
      // nos próximos fullName vem vazio. Manter os dados do banco intactos.
      return { success: true, error: null, isNewUser: false };
    }

    let tokenFCM: string | null = null;
    try {
      const { getFCMToken } = await import('../pushNotificationHandler');
      tokenFCM = await getFCMToken();
      if (tokenFCM) {
        console.log('🔑 Token FCM obtido ao criar usuário social:', tokenFCM);
      }
    } catch (tokenError) {
      console.log('⚠️ Erro ao obter token FCM (continuando sem token):', tokenError);
    }

    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: userId,
        name: socialData.name || 'Usuário',
        email: socialData.email,
        profile_url: socialData.photo || null,
        plan_is_active: false,
        token_fcm: tokenFCM || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('❌ [Social User] Erro ao criar usuário:', insertError);
      return { success: false, error: insertError.message };
    }

    return { success: true, error: null, isNewUser: true };
  } catch (error) {
    console.error('❌ [Social User] Erro inesperado:', error);
    return { success: false, error: 'Erro de conexão' };
  }
};

export const createOrUpdateUserFromGoogle = async (
  userId: string,
  googleData: {
    name: string;
    email: string;
    photo?: string;
  }
): Promise<{ success: boolean; error: string | null; isNewUser?: boolean }> => {
  return upsertSocialUserProfile(userId, {
    name: googleData.name,
    email: googleData.email,
    photo: googleData.photo || null
  });
};

export const createOrUpdateUserFromApple = async (
  userId: string,
  appleData: {
    name?: string;
    email: string;
    photo?: string;
  }
): Promise<{ success: boolean; error: string | null; isNewUser?: boolean }> => {
  return upsertSocialUserProfile(userId, {
    name: appleData.name,
    email: appleData.email,
    photo: appleData.photo || null
  });
};

// Buscar perfil do usuário
export const getUserProfile = async (userId: string): Promise<{ profile: UserProfile | null; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle(); // Usar maybeSingle() ao invés de single() para evitar erro se não houver resultado

    if (error) {
      console.error('❌ Erro ao buscar perfil:', error);
      return { profile: null, error: error.message };
    }

    if (!data) {
      return { profile: null, error: 'Perfil não encontrado' };
    }

    console.log('✅ Perfil encontrado:', data);
    return { profile: data, error: null };
  } catch (error) {
    console.error('💥 Erro de conexão ao buscar perfil:', error);
    return { profile: null, error: 'Erro de conexão' };
  }
};

// Atualizar perfil do usuário
export const updateUserProfile = async (userId: string, userData: Partial<CreateUserProfileData>): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase
      .from('users')
      .update({
        ...userData,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

/** Máximo de perfis de artista que o usuário pode possuir como admin/owner no plano gratuito (`plan_is_active` falso). */
export const FREE_PLAN_MAX_OWNED_ARTIST_PROFILES = 1;

/** Máximo de colaboradores no time de cada artista no gratuito (além do dono/admin principal). Total de pessoas no `artist_members` = 1 + isso. */
export const FREE_PLAN_MAX_COLLABORATORS_PER_ARTIST = 4;

/** Total de membros permitidos no artista no plano gratuito (você + colaboradores). */
export const FREE_PLAN_MAX_TEAM_MEMBERS_PER_ARTIST = 1 + FREE_PLAN_MAX_COLLABORATORS_PER_ARTIST;

const FREE_PLAN_TEAM_LIMIT_MESSAGE =
  'No plano gratuito, cada artista pode ter no máximo 4 colaboradores (5 pessoas no time no total). Se algum administrador ou proprietário tiver Premium, o limite some.';

/** Algum admin/owner do artista com `plan_is_active` no `users` libera time ilimitado para esse artista. */
export const artistTeamHasPremiumQuota = async (
  artistId: string,
): Promise<{ premium: boolean; error: string | null }> => {
  try {
    const { data: leads, error } = await supabase
      .from('artist_members')
      .select('user_id')
      .eq('artist_id', artistId)
      .in('role', ['admin', 'owner']);

    if (error) {
      return { premium: false, error: error.message };
    }
    if (!leads?.length) {
      return { premium: false, error: null };
    }

    const ids = [...new Set(leads.map((r) => r.user_id))];
    const { data: userRows, error: usersError } = await supabase
      .from('users')
      .select('plan_is_active')
      .in('id', ids);

    if (usersError) {
      return { premium: false, error: usersError.message };
    }

    const premium = userRows?.some((u) => u.plan_is_active === true) ?? false;
    return { premium, error: null };
  } catch {
    return { premium: false, error: 'Erro de conexão' };
  }
};

export const getArtistMemberCount = async (
  artistId: string,
): Promise<{ count: number; error: string | null }> => {
  try {
    const { count, error } = await supabase
      .from('artist_members')
      .select('*', { count: 'exact', head: true })
      .eq('artist_id', artistId);

    if (error) {
      return { count: 0, error: error.message };
    }
    return { count: count ?? 0, error: null };
  } catch {
    return { count: 0, error: 'Erro de conexão' };
  }
};

/** Convites pendentes que reservam vaga ao serem aceitos. */
export const countPendingArtistInvites = async (artistId: string): Promise<{ count: number; error: string | null }> => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('artist_id', artistId)
      .eq('status', 'pending')
      .in('type', ['invite', 'collaborator_invite']);

    if (error) {
      return { count: 0, error: error.message };
    }
    return { count: count ?? 0, error: null };
  } catch {
    return { count: 0, error: 'Erro de conexão' };
  }
};

export type ArtistTeamSlotMode = 'send_invite' | 'add_member';

/** Valida limite de time no plano gratuito para um artista. */
export const assertArtistTeamSlot = async (
  artistId: string,
  mode: ArtistTeamSlotMode,
): Promise<{ ok: boolean; userMessage: string | null; error: string | null }> => {
  try {
    const { premium, error: pErr } = await artistTeamHasPremiumQuota(artistId);
    if (pErr) {
      return { ok: false, userMessage: null, error: pErr };
    }
    if (premium) {
      return { ok: true, userMessage: null, error: null };
    }

    const { count: memberCount, error: mErr } = await getArtistMemberCount(artistId);
    if (mErr) {
      return { ok: false, userMessage: null, error: mErr };
    }

    if (mode === 'add_member') {
      if (memberCount >= FREE_PLAN_MAX_TEAM_MEMBERS_PER_ARTIST) {
        return { ok: false, userMessage: FREE_PLAN_TEAM_LIMIT_MESSAGE, error: null };
      }
      return { ok: true, userMessage: null, error: null };
    }

    const { count: pending, error: pendErr } = await countPendingArtistInvites(artistId);
    if (pendErr) {
      return { ok: false, userMessage: null, error: pendErr };
    }

    if (memberCount + pending >= FREE_PLAN_MAX_TEAM_MEMBERS_PER_ARTIST) {
      return { ok: false, userMessage: FREE_PLAN_TEAM_LIMIT_MESSAGE, error: null };
    }
    return { ok: true, userMessage: null, error: null };
  } catch {
    return { ok: false, userMessage: null, error: 'Erro de conexão' };
  }
};

export interface CanCreateArtistResult {
  canCreate: boolean;
  error: string | null;
  isPremium: boolean;
  ownedAsAdminCount: number;
}

// Verificar se o usuário pode criar mais perfis de artista (como dono/admin)
export const canCreateArtist = async (userId: string): Promise<CanCreateArtistResult> => {
  try {
    const { profile, error: profileError } = await getUserProfile(userId);
    const isPremium = profile?.plan_is_active === true;

    const { count, error: countError } = await supabase
      .from('artist_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('role', ['admin', 'owner']);

    if (countError) {
      console.error('❌ [canCreateArtist] Erro ao contar artistas:', countError);
      return {
        canCreate: false,
        error: countError.message,
        isPremium,
        ownedAsAdminCount: 0,
      };
    }

    const ownedAsAdminCount = count ?? 0;
    const canCreate = isPremium || ownedAsAdminCount < FREE_PLAN_MAX_OWNED_ARTIST_PROFILES;

    if (profileError && !profile) {
      console.warn('⚠️ [canCreateArtist] Perfil users ausente; limite free aplicado:', profileError);
    }

    return { canCreate, error: null, isPremium, ownedAsAdminCount };
  } catch (error) {
    console.error('❌ [canCreateArtist] Erro de conexão:', error);
    return { canCreate: false, error: 'Erro de conexão', isPremium: false, ownedAsAdminCount: 0 };
  }
};

// Verificar se o usuário pode exportar dados (todos os recursos liberados)
export const canExportData = async (userId: string): Promise<{ canExport: boolean; error: string | null }> => {
  return { canExport: true, error: null };
};

// Salvar ou atualizar token FCM do usuário
export const saveFCMToken = async (userId: string, token: string): Promise<{ success: boolean; error: string | null }> => {
  try {
    console.log('💾 [saveFCMToken] Salvando token FCM para usuário:', userId);
    
    const { error } = await supabase
      .from('users')
      .update({
        token_fcm: token,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('❌ [saveFCMToken] Erro ao salvar token:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ [saveFCMToken] Token FCM salvo com sucesso!');
    return { success: true, error: null };
  } catch (error) {
    console.error('❌ [saveFCMToken] Erro de conexão:', error);
    return { success: false, error: 'Erro de conexão' };
  }
};