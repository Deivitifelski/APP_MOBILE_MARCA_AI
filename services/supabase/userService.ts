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
      const updatePayload: { name?: string; email?: string; profile_url?: string | null; updated_at: string } = {
        updated_at: new Date().toISOString(),
      };

      if (socialData.name) {
        updatePayload.name = socialData.name;
      }

      if (socialData.email) {
        updatePayload.email = socialData.email;
      }

      if (socialData.photo !== undefined) {
        updatePayload.profile_url = socialData.photo;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', userId);

      if (updateError) {
        console.error('❌ [Social User] Erro ao atualizar usuário:', updateError);
        return { success: false, error: updateError.message };
      }

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

// Verificar se o usuário tem plano premium
export const isPremiumUser = async (userId: string): Promise<{ isPremium: boolean; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('plan_is_active')
      .eq('id', userId)
      .single();

    if (error) {
      // Se a coluna não existir, retornar false como padrão
      if (error.message.includes('column') && error.message.includes('plan_is_active')) {
        return { isPremium: false, error: null };
      }
      
      return { isPremium: false, error: error.message };
    }

    // Se plan_is_active for null ou undefined, retornar false como padrão
    const isPremium = data?.plan_is_active === true;
    return { isPremium, error: null };
  } catch (error) {
    return { isPremium: false, error: 'Erro de conexão' };
  }
};

// Verificar se o usuário pode criar mais artistas (todos os recursos liberados - limite alto para todos)
export const canCreateArtist = async (userId: string): Promise<{ canCreate: boolean; error: string | null }> => {
  try {
    const { data, error: countError } = await supabase
      .from('artist_members')
      .select('artist_id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('role', 'admin');

    if (countError) {
      console.error('❌ [canCreateArtist] Erro ao contar artistas:', countError);
      return { canCreate: false, error: countError.message };
    }

    const artistCount = data?.length || 0;
    const canCreate = artistCount < 50;

    return { canCreate, error: null };
  } catch (error) {
    console.error('❌ [canCreateArtist] Erro de conexão:', error);
    return { canCreate: false, error: 'Erro de conexão' };
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