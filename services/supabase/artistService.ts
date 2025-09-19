import { supabase } from '../../lib/supabase';
import { getUsuarioPlano } from './planService';

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

// Verificar se usuário pode criar mais artistas
export const canCreateArtist = async (userId: string): Promise<{ success: boolean; canCreate: boolean; currentCount?: number; maxCount?: number; error?: string }> => {
  try {
    // Buscar plano do usuário
    const { success: planoSuccess, usuarioPlano, error: planoError } = await getUsuarioPlano(userId);
    
    if (!planoSuccess) {
      // Se não tem plano, permite criar (primeiro artista)
      return { success: true, canCreate: true, currentCount: 0, maxCount: 1 };
    }

    if (!usuarioPlano) {
      // Se não tem plano, permite criar (primeiro artista)
      return { success: true, canCreate: true, currentCount: 0, maxCount: 1 };
    }

    const plano = usuarioPlano.plano;
    
    // Se max_usuarios é null, significa ilimitado
    if (plano.max_usuarios === null) {
      return { success: true, canCreate: true, currentCount: 0, maxCount: null };
    }

    // Contar artistas atuais (onde o usuário é owner)
    const { data: artistas, error: countError } = await supabase
      .from('artist_members')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('role', 'owner');

    if (countError) {
      return { success: false, canCreate: false, error: countError.message };
    }

    const currentCount = artistas?.length || 0;
    const canCreate = currentCount < plano.max_usuarios;

    return { 
      success: true, 
      canCreate, 
      currentCount, 
      maxCount: plano.max_usuarios 
    };
  } catch (error) {
    return { success: false, canCreate: false, error: 'Erro de conexão' };
  }
};

// Criar perfil do artista
export const createArtist = async (artistData: CreateArtistData): Promise<{ success: boolean; error: string | null; artist?: Artist }> => {
  try {
    // Verificar se o usuário pode criar mais artistas
    const { success: canCreate, canCreate: canCreateMore, currentCount, maxCount, error: limitError } = await canCreateArtist(artistData.user_id);
    
    if (!canCreate || !canCreateMore) {
      const message = maxCount === null 
        ? 'Erro ao verificar limite de artistas'
        : `Você atingiu o limite de ${maxCount} artista${maxCount > 1 ? 's' : ''} do seu plano. Atualmente você tem ${currentCount} artista${currentCount > 1 ? 's' : ''}.`;
      
      return { success: false, error: message };
    }

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
    // Primeiro, buscar os membros do usuário
    const { data: membersData, error: membersError } = await supabase
      .from('artist_members')
      .select('artist_id, role')
      .eq('user_id', userId);

    if (membersError) {
      return { artists: null, error: membersError.message };
    }

    if (!membersData || membersData.length === 0) {
      return { artists: [], error: null };
    }

    // Buscar os artistas usando os IDs dos membros
    const artistIds = membersData.map(member => member.artist_id);
    const { data: artistsData, error: artistsError } = await supabase
      .from('artists')
      .select('id, name, profile_url, created_at, updated_at')
      .in('id', artistIds);

    if (artistsError) {
      return { artists: null, error: artistsError.message };
    }

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
