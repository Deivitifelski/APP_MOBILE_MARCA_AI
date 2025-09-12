import { supabase } from '../../../lib/supabase';

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
    const { data, error } = await supabase
      .from('artist_members')
      .select(`
        artist_id,
        role,
        artists (
          id,
          name,
          profile_url,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return { artists: null, error: error.message };
    }

    // Transformar os dados para o formato esperado
    const artists = data?.map(item => ({
      id: item.artists.id,
      name: item.artists.name,
      profile_url: item.artists.profile_url,
      role: item.role,
      created_at: item.artists.created_at,
      updated_at: item.artists.updated_at
    })) || [];

    return { artists, error: null };
  } catch (error) {
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
