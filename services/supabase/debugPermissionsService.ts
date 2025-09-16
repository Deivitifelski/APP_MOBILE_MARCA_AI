import { supabase } from '../../lib/supabase';

// Função de debug para verificar permissões
export const debugUserPermissions = async (userId: string, artistId: string) => {
  try {
    console.log('🔍 Debug - Verificando permissões para:', { userId, artistId });

    // 1. Verificar se o usuário existe na tabela artist_members
    const { data: memberData, error: memberError } = await supabase
      .from('artist_members')
      .select('*')
      .eq('user_id', userId)
      .eq('artist_id', artistId)
      .single();

    console.log('📋 Debug - Dados do membro:', { memberData, memberError });

    if (memberError) {
      console.error('❌ Erro ao buscar membro:', memberError);
      return { success: false, error: memberError.message };
    }

    if (!memberData) {
      console.log('❌ Usuário não é membro do artista');
      return { success: false, error: 'Usuário não é membro do artista' };
    }

    // 2. Verificar se o artista existe
    const { data: artistData, error: artistError } = await supabase
      .from('artists')
      .select('*')
      .eq('id', artistId)
      .single();

    console.log('🎭 Debug - Dados do artista:', { artistData, artistError });

    if (artistError) {
      console.error('❌ Erro ao buscar artista:', artistError);
      return { success: false, error: artistError.message };
    }

    // 3. Testar consulta com RLS
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('artist_id', artistId)
      .limit(5);

    console.log('📅 Debug - Eventos encontrados:', { eventsData, eventsError });

    return {
      success: true,
      data: {
        member: memberData,
        artist: artistData,
        events: eventsData,
        role: memberData.role
      }
    };

  } catch (error) {
    console.error('❌ Erro inesperado no debug:', error);
    return { success: false, error: 'Erro inesperado' };
  }
};

// Função para listar todos os artistas do usuário
export const debugUserArtists = async (userId: string) => {
  try {
    console.log('🔍 Debug - Listando artistas do usuário:', userId);

    const { data, error } = await supabase
      .from('artist_members')
      .select(`
        *,
        artist:artists(*)
      `)
      .eq('user_id', userId);

    console.log('🎭 Debug - Artistas do usuário:', { data, error });

    return { success: !error, data, error: error?.message };
  } catch (error) {
    console.error('❌ Erro ao listar artistas:', error);
    return { success: false, error: 'Erro inesperado' };
  }
};
