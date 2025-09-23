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
    // Usar supabase.functions.invoke
    const { data, error } = await supabase.functions.invoke('create-custumer', {
      body: {
        email: customerData.email,
        userId: customerData.userId,
        name: customerData.name
      }
    });

    if (error) {
      return { 
        success: false, 
        error: `Função retornou erro: ${error.message || JSON.stringify(error)}` 
      };
    }

    // Converter string para objeto se necessário
    let parsedData = data;
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data);
      } catch (parseError) {
        return {
          success: false,
          error: 'Erro ao processar resposta da função'
        };
      }
    }

    if (parsedData && parsedData.customerId) {
      return { 
        success: true, 
        customerId: parsedData.customerId, 
        error: null 
      };
    }

    return { 
      success: false, 
      error: `Resposta inválida: ${JSON.stringify(data)}` 
    };

  } catch (error) {
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
