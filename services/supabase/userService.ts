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
    console.log('🔧 Testando função create-customers...');
    console.log('📋 Dados exatos:', JSON.stringify(customerData, null, 2));
    
    // Primeira tentativa: padrão supabase.functions.invoke
    const response = await supabase.functions.invoke('create-customer', {
      body: customerData
    });

    console.log('📦 Resposta completa:', JSON.stringify(response, null, 2));
    console.log('📊 Status da resposta:', response.error ? 'ERRO' : 'SUCESSO');
    
    if (response.error) {
      console.error('❌ Detalhes do erro:', {
        message: response.error.message,
        context: response.error.context,
        details: response.error
      });
      
      return { 
        success: false, 
        error: `Função retornou erro: ${response.error.message || JSON.stringify(response.error)}` 
      };
    }

    if (response.data && response.data.customerId) {
      console.log('✅ Customer ID recebido:', response.data.customerId);
      return { 
        success: true, 
        customerId: response.data.customerId, 
        error: null 
      };
    }

    console.warn('⚠️ Resposta sem customerId:', response.data);
    return { 
      success: false, 
      error: `Resposta inesperada: ${JSON.stringify(response.data)}` 
    };
    
  } catch (error) {
    console.error('💥 Erro na tentativa de chamada:', error);
    return { 
      success: false, 
      error: `Exceção: ${error instanceof Error ? error.message : String(error)}` 
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
