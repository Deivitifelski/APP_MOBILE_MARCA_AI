import { supabase } from '../../lib/supabase';

export type UserPlan = 'free' | 'premium';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  city?: string;
  state?: string;
  phone?: string;
  profile_url?: string;
  plan: UserPlan;
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
  plan?: UserPlan;
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
        plan: userData.plan || 'free',
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
export const createOrUpdateUserFromGoogle = async (
  userId: string,
  googleData: {
    name: string;
    email: string;
    photo?: string;
  }
): Promise<{ success: boolean; error: string | null; isNewUser?: boolean }> => {
  try {
    // Verificar se o usuário já existe
    const { exists, error: checkError } = await checkUserExists(userId);

    if (checkError) {
      console.error('❌ [Google User] Erro ao verificar usuário:', checkError);
      return { success: false, error: checkError };
    }

    if (exists) {
      // Atualizar dados do usuário existente
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name: googleData.name,
          email: googleData.email,
          profile_url: googleData.photo || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        console.error('❌ [Google User] Erro ao atualizar usuário:', updateError);
        return { success: false, error: updateError.message };
      }

      return { success: true, error: null, isNewUser: false };
    } else {
      // Criar novo usuário
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: userId,
          name: googleData.name,
          email: googleData.email,
          profile_url: googleData.photo || null,
          plan: 'free',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('❌ [Google User] Erro ao criar usuário:', insertError);
        return { success: false, error: insertError.message };
      }

      return { success: true, error: null, isNewUser: true };
    }
  } catch (error) {
    console.error('❌ [Google User] Erro inesperado:', error);
    return { success: false, error: 'Erro de conexão' };
  }
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

// Verificar o plano do usuário
export const getUserPlan = async (userId: string): Promise<{ plan: UserPlan | null; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('plan')
      .eq('id', userId)
      .single();

    if (error) {
      // Se a coluna não existir, retornar 'free' como padrão
      if (error.message.includes('column') && error.message.includes('plan')) {
        return { plan: 'free', error: null };
      }
      
      return { plan: null, error: error.message };
    }

    // Se o plano for null ou undefined, retornar 'free' como padrão
    const plan = data?.plan || 'free';
    return { plan: plan as UserPlan, error: null };
  } catch (error) {
    return { plan: null, error: 'Erro de conexão' };
  }
};

// Verificar se o usuário tem plano premium
export const isPremiumUser = async (userId: string): Promise<{ isPremium: boolean; error: string | null }> => {
  try {
    const { plan, error } = await getUserPlan(userId);
    
    if (error) {
      return { isPremium: false, error };
    }

    return { isPremium: plan === 'premium', error: null };
  } catch (error) {
    return { isPremium: false, error: 'Erro de conexão' };
  }
};

// Verificar se o usuário pode criar mais artistas (limitação do plano free)
export const canCreateArtist = async (userId: string): Promise<{ canCreate: boolean; error: string | null }> => {
  try {
    const { plan, error } = await getUserPlan(userId);
    if (error) {
      console.error('❌ [canCreateArtist] Erro ao obter plano:', error);
      return { canCreate: false, error };
    }

    // Se for premium, pode criar até 50 artistas
    if (plan === 'premium') {
      // Verificar quantos artistas o usuário premium já possui
      const { data, error: countError } = await supabase
        .from('artist_members')
        .select('artist_id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('role', 'admin'); // Apenas artistas onde o usuário é admin (criador)

      if (countError) {
        console.error('❌ [canCreateArtist] Erro ao contar artistas:', countError);
        return { canCreate: false, error: countError.message };
      }

      const artistCount = data?.length || 0;
      const canCreate = artistCount < 50;
      
      return { canCreate, error: null };
    }

    // Se for free, verificar quantos artistas já possui através de artist_members
    const { data, error: countError } = await supabase
      .from('artist_members')
      .select('artist_id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('role', 'admin'); // Apenas artistas onde o usuário é admin (criador)

    if (countError) {
      console.error('❌ [canCreateArtist] Erro ao contar artistas:', countError);
      return { canCreate: false, error: countError.message };
    }

    // Plano free permite até 2 artistas
    const artistCount = data?.length || 0;
    const canCreate = artistCount < 2;

    return { canCreate, error: null };
  } catch (error) {
    console.error('❌ [canCreateArtist] Erro de conexão:', error);
    return { canCreate: false, error: 'Erro de conexão' };
  }
};

// Verificar se o usuário pode exportar dados (limitação do plano free)
export const canExportData = async (userId: string): Promise<{ canExport: boolean; error: string | null }> => {
  try {
    const { plan, error } = await getUserPlan(userId);
    if (error) {
      return { canExport: false, error };
    }

    // Apenas usuários premium podem exportar dados
    const canExport = plan === 'premium';

    return { canExport, error: null };
  } catch (error) {
    return { canExport: false, error: 'Erro de conexão' };
  }
};