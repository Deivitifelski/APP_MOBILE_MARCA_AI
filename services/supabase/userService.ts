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
    console.log('🔍 checkUserExists: Verificando usuário:', userId);
    
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

// Buscar perfil do usuário
export const getUserProfile = async (userId: string): Promise<{ profile: UserProfile | null; error: string | null }> => {
  try {
    console.log('👤 Buscando perfil do usuário:', userId);
    
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
      console.warn('⚠️ Nenhum perfil encontrado para o usuário:', userId);
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
    console.log('🔍 getUserPlan: Buscando plano para usuário:', userId);
    
    const { data, error } = await supabase
      .from('users')
      .select('plan')
      .eq('id', userId)
      .single();

    console.log('📋 getUserPlan: Dados obtidos:', { data, error });

    if (error) {
      console.log('❌ getUserPlan: Erro na consulta:', error.message);
      
      // Se a coluna não existir, retornar 'free' como padrão
      if (error.message.includes('column') && error.message.includes('plan')) {
        console.log('⚠️ getUserPlan: Coluna plan não existe, retornando free como padrão');
        return { plan: 'free', error: null };
      }
      
      return { plan: null, error: error.message };
    }

    // Se o plano for null ou undefined, retornar 'free' como padrão
    const plan = data?.plan || 'free';
    console.log('✅ getUserPlan: Plano encontrado:', plan);
    return { plan: plan as UserPlan, error: null };
  } catch (error) {
    console.log('💥 getUserPlan: Erro de conexão:', error);
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
      return { canCreate: false, error };
    }

    // Se for premium, pode criar ilimitados
    if (plan === 'premium') {
      return { canCreate: true, error: null };
    }

    // Se for free, verificar quantos artistas já possui
    const { data, error: countError } = await supabase
      .from('artists')
      .select('id', { count: 'exact' })
      .eq('user_id', userId);

    if (countError) {
      return { canCreate: false, error: countError.message };
    }

    // Plano free permite apenas 1 artista
    const canCreate = (data?.length || 0) < 1;
    return { canCreate, error: null };
  } catch (error) {
    return { canCreate: false, error: 'Erro de conexão' };
  }
};

// Verificar se o usuário pode exportar dados (limitação do plano free)
export const canExportData = async (userId: string): Promise<{ canExport: boolean; error: string | null }> => {
  try {
    console.log('🔍 canExportData: Verificando plano para usuário:', userId);
    
    const { plan, error } = await getUserPlan(userId);
    
    console.log('📋 canExportData: Plano obtido:', { plan, error });
    
    if (error) {
      console.log('❌ canExportData: Erro ao obter plano:', error);
      return { canExport: false, error };
    }

    // Apenas usuários premium podem exportar dados
    const canExport = plan === 'premium';
    console.log('🎯 canExportData: Resultado final:', { plan, canExport });
    
    return { canExport, error: null };
  } catch (error) {
    console.log('💥 canExportData: Erro de conexão:', error);
    return { canExport: false, error: 'Erro de conexão' };
  }
};