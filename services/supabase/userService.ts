import { supabase } from '../../lib/supabase';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  city?: string;
  state?: string;
  phone?: string;
  profile_url?: string;
  customer_id?: string;
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
  customer_id?: string;
}

export interface CreateCustomerData {
  email: string;
  userId: string;
  name: string;
}

export interface CreateCustomerResponse {
  customerId: string;
}

// Verificar se o usuário existe na tabela users
export const checkUserExists = async (userId: string): Promise<{ exists: boolean; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (error) {
      // Se o erro for "PGRST116" significa que nenhum registro foi encontrado
      if (error.code === 'PGRST116') {
        return { exists: false, error: null };
      }
      return { exists: false, error: error.message };
    }

    return { exists: true, error: null };
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
        customer_id: userData.customer_id || null,
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
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      return { profile: null, error: error.message };
    }

    return { profile: data, error: null };
  } catch (error) {
    return { profile: null, error: 'Erro de conexão' };
  }
};

// Criar customer no Stripe via edge function
export const createStripeCustomer = async (customerData: CreateCustomerData): Promise<{ success: boolean; customerId?: string; error: string | null }> => {
  try {
    console.log('🔍 Debug - Dados enviados:');
    console.log('   📦 email:', customerData.email);
    console.log('   ❌ userId:', customerData.userId);
    console.log('   📊 name:', customerData.name);

    // Usar supabase.functions.invoke
    const { data, error } = await supabase.functions.invoke('create-custumer', {
      body: {
        email: customerData.email,
        userId: customerData.userId,
        name: customerData.name
      }
    });

    console.log('🔍 Debug - Resposta da função:');
    console.log('   📦 data:', data);
    console.log('   📦 tipo de data:', typeof data);
    console.log('   📦 data.customerId:', data?.customerId);
    console.log('   ❌ error:', error);

    if (error) {
      console.log('❌ Erro retornado pela função:', error);
      return { 
        success: false, 
        error: `Função retornou erro: ${error.message || JSON.stringify(error)}` 
      };
    }

    if (data && data.customerId) {
      console.log('✅ Customer ID encontrado:', data.customerId);
      return { 
        success: true, 
        customerId: data.customerId, 
        error: null 
      };
    }

    console.log('❌ Customer ID não encontrado na resposta');
    return { 
      success: false, 
      error: `Resposta inválida: ${JSON.stringify(data)}` 
    };

  } catch (error) {
    console.error('💥 Erro na chamada da função:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro de conexão'
    };
  }
};

// Atualizar customer_id do usuário
export const updateUserCustomerId = async (userId: string, customerId: string): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase
      .from('users')
      .update({
        customer_id: customerId,
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
