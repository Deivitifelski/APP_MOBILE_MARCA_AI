import { supabase } from '../../lib/supabase';

export interface Artist {
  id: string;
  name: string;
  profile_url?: string;
  role?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateArtistData {
  name: string;
  profile_url?: string;
  user_id: string;
}

// Versão que usa RPC para contornar possíveis problemas do cliente
export const createArtistDirect = async (artistData: CreateArtistData): Promise<{ success: boolean; error: string | null; artist?: Artist }> => {
  try {
    console.log('🔍 DIRECT DEBUG: Iniciando criação direta do artista');
    console.log('🔍 DIRECT DEBUG: Dados recebidos:', artistData);
    
    // 1. Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ DIRECT DEBUG: Erro de autenticação:', authError);
      return { success: false, error: 'Usuário não autenticado' };
    }
    
    console.log('✅ DIRECT DEBUG: Usuário autenticado:', user.id);
    
    // 2. Usar RPC para inserir artista
    console.log('🔍 DIRECT DEBUG: Chamando RPC para criar artista...');
    
    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_artist_direct', {
      p_name: artistData.name,
      p_profile_url: artistData.profile_url || null,
      p_user_id: artistData.user_id
    });
    
    console.log('🔍 DIRECT DEBUG: Resultado RPC:', { rpcResult, rpcError });
    
    if (rpcError) {
      console.error('❌ DIRECT DEBUG: Erro no RPC:', rpcError);
      return { success: false, error: `Erro no RPC: ${rpcError.message}` };
    }
    
    console.log('✅ DIRECT DEBUG: Artista criado via RPC:', rpcResult);
    
    return { success: true, error: null, artist: rpcResult };
    
  } catch (error) {
    console.error('❌ DIRECT DEBUG: Erro inesperado:', error);
    return { success: false, error: `Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}` };
  }
};

// Versão que usa fetch direto para contornar o cliente Supabase
export const createArtistFetch = async (artistData: CreateArtistData): Promise<{ success: boolean; error: string | null; artist?: Artist }> => {
  try {
    console.log('🔍 FETCH DEBUG: Iniciando criação via fetch');
    console.log('🔍 FETCH DEBUG: Dados recebidos:', artistData);
    
    // 1. Obter token de autenticação
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('❌ FETCH DEBUG: Erro ao obter sessão:', sessionError);
      return { success: false, error: 'Sessão não encontrada' };
    }
    
    console.log('✅ FETCH DEBUG: Sessão obtida');
    
    // 2. Fazer requisição direta via fetch
    const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/artists`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        name: artistData.name,
        profile_url: artistData.profile_url || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });
    
    console.log('🔍 FETCH DEBUG: Status da resposta:', response.status);
    console.log('🔍 FETCH DEBUG: Headers da resposta:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ FETCH DEBUG: Erro na resposta:', errorText);
      return { success: false, error: `Erro HTTP ${response.status}: ${errorText}` };
    }
    
    const result = await response.json();
    console.log('✅ FETCH DEBUG: Artista criado via fetch:', result);
    
    // 3. Criar relacionamento artist_members
    const memberResponse = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/artist_members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        user_id: artistData.user_id,
        artist_id: result[0].id,
        role: 'owner',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });
    
    console.log('🔍 FETCH DEBUG: Status da resposta do membro:', memberResponse.status);
    
    if (!memberResponse.ok) {
      const errorText = await memberResponse.text();
      console.error('❌ FETCH DEBUG: Erro ao criar membro:', errorText);
      return { success: false, error: `Erro ao criar membro: ${errorText}` };
    }
    
    console.log('✅ FETCH DEBUG: Membro criado via fetch');
    
    return { success: true, error: null, artist: result[0] };
    
  } catch (error) {
    console.error('❌ FETCH DEBUG: Erro inesperado:', error);
    return { success: false, error: `Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}` };
  }
};
