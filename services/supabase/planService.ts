import { supabase } from '../../lib/supabase';

export interface Plano {
  id: number;
  nome: string;
  max_usuarios: number | null;
  recursos: {
    export_financas?: boolean;
    colaboradores?: boolean;
    suporte_prioritario?: boolean;
  };
  preco: number;
  created_at: string;
  updated_at: string;
}

export interface UsuarioPlano {
  id_usuario: string;
  id_plano: number;
  data_inicio: string;
  data_fim: string | null;
  created_at: string;
  updated_at: string;
}

// Buscar todos os planos disponíveis
export const getPlanos = async (): Promise<{ success: boolean; planos?: Plano[]; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('planos')
      .select('*')
      .order('preco', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, planos: data || [] };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Buscar plano do usuário atual
export const getUsuarioPlano = async (userId: string): Promise<{ success: boolean; usuarioPlano?: UsuarioPlano & { plano: Plano }; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('usuario_plano')
      .select(`
        *,
        plano:planos(*)
      `)
      .eq('id_usuario', userId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, usuarioPlano: data };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Criar/atualizar plano do usuário
export const setUsuarioPlano = async (
  userId: string, 
  planoId: number, 
  dataFim?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Primeiro, verificar se já existe um plano para o usuário
    const { data: existingPlano, error: checkError } = await supabase
      .from('usuario_plano')
      .select('id_usuario')
      .eq('id_usuario', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      return { success: false, error: checkError.message };
    }

    const planoData = {
      id_usuario: userId,
      id_plano: planoId,
      data_inicio: new Date().toISOString(),
      data_fim: dataFim || null,
      updated_at: new Date().toISOString()
    };

    if (existingPlano) {
      // Atualizar plano existente
      const { error: updateError } = await supabase
        .from('usuario_plano')
        .update(planoData)
        .eq('id_usuario', userId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }
    } else {
      // Criar novo plano
      const { error: insertError } = await supabase
        .from('usuario_plano')
        .insert({
          ...planoData,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        return { success: false, error: insertError.message };
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Verificar se o usuário pode adicionar mais colaboradores
export const canAddColaborador = async (userId: string): Promise<{ success: boolean; canAdd: boolean; currentCount?: number; maxCount?: number; error?: string }> => {
  try {
    // Buscar plano do usuário
    const { success: planoSuccess, usuarioPlano, error: planoError } = await getUsuarioPlano(userId);
    
    if (!planoSuccess || !usuarioPlano) {
      return { success: false, canAdd: false, error: planoError || 'Plano não encontrado' };
    }

    const plano = usuarioPlano.plano;
    
    // Se max_usuarios é null, significa ilimitado
    if (plano.max_usuarios === null) {
      return { success: true, canAdd: true, currentCount: 0, maxCount: null };
    }

    // Contar colaboradores atuais
    const { data: colaboradores, error: countError } = await supabase
      .from('artist_members')
      .select('id', { count: 'exact' })
      .eq('user_id', userId);

    if (countError) {
      return { success: false, canAdd: false, error: countError.message };
    }

    const currentCount = colaboradores?.length || 0;
    const canAdd = currentCount < plano.max_usuarios;

    return { 
      success: true, 
      canAdd, 
      currentCount, 
      maxCount: plano.max_usuarios 
    };
  } catch (error) {
    return { success: false, canAdd: false, error: 'Erro de conexão' };
  }
};

// Verificar se o usuário tem acesso a um recurso específico
export const hasRecurso = async (userId: string, recurso: keyof Plano['recursos']): Promise<{ success: boolean; hasAccess: boolean; error?: string }> => {
  try {
    const { success, usuarioPlano, error } = await getUsuarioPlano(userId);
    
    if (!success || !usuarioPlano) {
      return { success: false, hasAccess: false, error: error || 'Plano não encontrado' };
    }

    const hasAccess = usuarioPlano.plano.recursos[recurso] === true;

    return { success: true, hasAccess };
  } catch (error) {
    return { success: false, hasAccess: false, error: 'Erro de conexão' };
  }
};

// Verificar se o plano do usuário está ativo
export const isPlanoAtivo = async (userId: string): Promise<{ success: boolean; isActive: boolean; error?: string }> => {
  try {
    const { success, usuarioPlano, error } = await getUsuarioPlano(userId);
    
    if (!success || !usuarioPlano) {
      return { success: false, isActive: false, error: error || 'Plano não encontrado' };
    }

    // Se data_fim é null, o plano é ativo indefinidamente (plano Free)
    if (usuarioPlano.data_fim === null) {
      return { success: true, isActive: true };
    }

    // Verificar se a data de fim ainda não passou
    const now = new Date();
    const dataFim = new Date(usuarioPlano.data_fim);
    const isActive = dataFim > now;

    return { success: true, isActive };
  } catch (error) {
    return { success: false, isActive: false, error: 'Erro de conexão' };
  }
};
