import { supabase } from '../../lib/supabase';

export interface Artist {
  id: string;
  name: string;
  musical_style?: string;
  profile_url?: string;
  role?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateArtistData {
  name: string;
  musical_style?: string;
  profile_url?: string;
  user_id: string;
}

// Criar perfil do artista
export const createArtist = async (artistData: CreateArtistData): Promise<{ success: boolean; error: string | null; artist?: Artist }> => {
  try {
    // Primeiro, criar o artista
    console.log('📊 [createArtist] Dados enviados:', artistData);
    console.log('📊 [createArtist] Nome:', artistData.name);
    console.log('📊 [createArtist] Musical Style:', artistData.musical_style);
    console.log('📊 [createArtist] Profile URL:', artistData.profile_url);
    console.log('📊 [createArtist] User ID:', artistData.user_id);
    console.log('📊 [createArtist] Created At:', new Date().toISOString());
    console.log('📊 [createArtist] Updated At:', new Date().toISOString());

    const { data: artistData_result, error: artistError } = await supabase
      .from('artists')
      .insert({
        name: artistData.name,
        musical_style: artistData.musical_style || null,
        profile_url: artistData.profile_url || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (artistError) {
      console.error('❌ Erro ao criar artista:', artistError.message);
      return { success: false, error: 'Aconteceu um erro ao tentar criar artista' };
    }

    // Depois, criar o relacionamento na tabela artist_members como admin (criador sempre é admin)
    const { error: memberError } = await supabase
      .from('artist_members')
      .insert({
        user_id: artistData.user_id,
        artist_id: artistData_result.id,
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (memberError) {
      // Se der erro no relacionamento, deletar o artista criado
      await supabase.from('artists').delete().eq('id', artistData_result.id);
      return { success: false, error: memberError.message };
    }

    return { success: true, error: null, artist: artistData_result };
  } catch {
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
      .select('id, name, profile_url, musical_style, created_at, updated_at')
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
        musical_style: artist.musical_style,
        role: member?.role || 'viewer',
        created_at: artist.created_at,
        updated_at: artist.updated_at
      };
    }) || [];

    return { artists, error: null };
  } catch {
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
  } catch {
    return { artist: null, error: 'Erro de conexão' };
  }
};

// Atualizar artista
export const updateArtist = async (artistId: string, artistData: Partial<CreateArtistData>): Promise<{ success: boolean; error: string | null; artist?: Artist }> => {
  try {
    console.log('🔄 UPDATE ARTIST - Dados enviados:', {
      artistId: artistId,
      name: artistData.name,
      profile_url: artistData.profile_url
    });

    const { data, error } = await supabase
      .from('artists')
      .update({
        name: artistData.name,
        profile_url: artistData.profile_url,
        musical_style: artistData.musical_style,
        updated_at: new Date().toISOString()
      })
      .eq('id', artistId)
      .select();

    console.log('📊 UPDATE ARTIST - Resultado:', {
      success: !error,
      error: error?.message,
      dataLength: data?.length,
      updatedArtist: data?.[0]
    });

    if (error) {
      console.error('❌ UPDATE ARTIST - Erro:', error);
      return { success: false, error: error.message };
    }

    // Retornar o primeiro (e único) resultado
    const updatedArtist = data && data.length > 0 ? data[0] : null;

    console.log('✅ UPDATE ARTIST - Sucesso! Artista atualizado:', {
      id: updatedArtist?.id,
      name: updatedArtist?.name,
      profile_url: updatedArtist?.profile_url
    });

    return { success: true, error: null, artist: updatedArtist || undefined };
  } catch (err) {
    console.error('💥 UPDATE ARTIST - Erro inesperado:', err);
    return { success: false, error: 'Erro de conexão' };
  }
};

// Deletar artista (com todos os dados relacionados)
export const deleteArtist = async (artistId: string): Promise<{ success: boolean; error: string | null }> => {
  try {
    // 1️⃣ Deletar despesas dos eventos do artista
    const { data: events } = await supabase
      .from('events')
      .select('id')
      .eq('artist_id', artistId);

    if (events && events.length > 0) {
      const eventIds = events.map(e => e.id);
      const { error: expensesError } = await supabase
        .from('event_expenses')
        .delete()
        .in('event_id', eventIds);

      if (expensesError) {
        return { success: false, error: 'Erro ao deletar despesas dos eventos: ' + expensesError.message };
      }
    }

    // 2️⃣ Deletar eventos do artista
    const { error: eventsError } = await supabase
      .from('events')
      .delete()
      .eq('artist_id', artistId);

    if (eventsError) {
      return { success: false, error: 'Erro ao deletar eventos: ' + eventsError.message };
    }

    // 3️⃣ Deletar convites pendentes do artista
    await supabase
      .from('artist_invites')
      .delete()
      .eq('artist_id', artistId);

    // 4️⃣ Deletar colaboradores (artist_members)
    const { error: membersError } = await supabase
      .from('artist_members')
      .delete()
      .eq('artist_id', artistId);

    if (membersError) {
      return { success: false, error: 'Erro ao deletar colaboradores: ' + membersError.message };
    }

    // 5️⃣ Deletar notificações relacionadas ao artista
    await supabase
      .from('notifications')
      .delete()
      .eq('artist_id', artistId);

    // 6️⃣ Finalmente, deletar o artista
    const { error: artistError } = await supabase
      .from('artists')
      .delete()
      .eq('id', artistId);

    if (artistError) {
      return { success: false, error: 'Erro ao deletar artista: ' + artistError.message };
    }

    return { success: true, error: null };

  } catch {
    return { success: false, error: 'Erro de conexão ao deletar artista' };
  }
};
