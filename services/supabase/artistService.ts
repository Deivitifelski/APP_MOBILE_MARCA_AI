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

// Criar perfil do artista
export const createArtist = async (artistData: CreateArtistData): Promise<{ success: boolean; error: string | null; artist?: Artist }> => {
  try {
    // Primeiro, criar o artista
    const { data: artistData_result, error: artistError } = await supabase
      .from('artists')
      .insert({
        name: artistData.name,
        profile_url: artistData.profile_url || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (artistError) {
      return { success: false, error: artistError.message };
    }

    // Depois, criar o relacionamento na tabela artist_members como owner
    const { error: memberError } = await supabase
      .from('artist_members')
      .insert({
        user_id: artistData.user_id,
        artist_id: artistData_result.id,
        role: 'owner',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (memberError) {
      // Se der erro no relacionamento, deletar o artista criado
      await supabase.from('artists').delete().eq('id', artistData_result.id);
      return { success: false, error: memberError.message };
    }

    return { success: true, error: null, artist: artistData_result };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Buscar artistas do usuário atual
export const getArtists = async (userId: string): Promise<{ artists: Artist[] | null; error: string | null }> => {
  try {
    console.log('🔍 getArtists: Buscando artistas para usuário:', userId);
    
    // Primeiro, buscar os membros do usuário
    const { data: membersData, error: membersError } = await supabase
      .from('artist_members')
      .select('artist_id, role')
      .eq('user_id', userId);

    if (membersError) {
      console.error('❌ getArtists: Erro ao buscar membros:', membersError);
      return { artists: null, error: membersError.message };
    }

    console.log('📋 getArtists: Membros encontrados:', membersData?.length || 0);

    if (!membersData || membersData.length === 0) {
      console.log('❌ getArtists: Usuário não é membro de nenhum artista');
      return { artists: [], error: null };
    }

    // Buscar os artistas usando os IDs dos membros
    const artistIds = membersData.map(member => member.artist_id);
    const { data: artistsData, error: artistsError } = await supabase
      .from('artists')
      .select('id, name, profile_url, created_at, updated_at')
      .in('id', artistIds);

    if (artistsError) {
      console.error('❌ getArtists: Erro ao buscar artistas:', artistsError);
      return { artists: null, error: artistsError.message };
    }

    console.log('🎭 getArtists: Artistas encontrados:', artistsData?.length || 0);

    // Combinar os dados
    const artists = artistsData?.map(artist => {
      const member = membersData.find(m => m.artist_id === artist.id);
      return {
        id: artist.id,
        name: artist.name,
        profile_url: artist.profile_url,
        role: member?.role || 'viewer',
        created_at: artist.created_at,
        updated_at: artist.updated_at
      };
    }) || [];

    console.log('✅ getArtists: Artistas finais:', artists);
    return { artists, error: null };
  } catch (error) {
    console.error('❌ getArtists: Erro inesperado:', error);
    return { artists: null, error: 'Erro de conexão' };
  }
};

// Buscar artista por ID
export const getArtistById = async (artistId: string): Promise<{ artist: Artist | null; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('artists')
      .select('*')
      .eq('id', artistId)
      .single();

    if (error) {
      return { artist: null, error: error.message };
    }

    return { artist: data, error: null };
  } catch (error) {
    return { artist: null, error: 'Erro de conexão' };
  }
};

// Atualizar artista
export const updateArtist = async (artistId: string, artistData: Partial<CreateArtistData>): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase
      .from('artists')
      .update({
        ...artistData,
        updated_at: new Date().toISOString()
      })
      .eq('id', artistId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Deletar artista
export const deleteArtist = async (artistId: string): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase
      .from('artists')
      .delete()
      .eq('id', artistId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};
