import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ActiveArtist {
  id: string;
  name: string;
  role: string;
  profile_url?: string;
}

const ACTIVE_ARTIST_KEY = '@marca_ai:active_artist';

// Salvar artista ativo no AsyncStorage
export const setActiveArtist = async (artist: ActiveArtist): Promise<void> => {
  try {
    await AsyncStorage.setItem(ACTIVE_ARTIST_KEY, JSON.stringify(artist));
    console.log('✅ Artista ativo salvo no AsyncStorage:', artist.name);
  } catch (error) {
    console.error('❌ Erro ao salvar artista ativo:', error);
  }
};

// Obter artista ativo do AsyncStorage
export const getActiveArtist = async (): Promise<ActiveArtist | null> => {
  try {
    const stored = await AsyncStorage.getItem(ACTIVE_ARTIST_KEY);
    if (stored) {
      const artist = JSON.parse(stored);
      console.log('📖 Artista ativo carregado do AsyncStorage:', artist.name);
      return artist;
    }
    console.log('📭 Nenhum artista ativo salvo');
    return null;
  } catch (error) {
    console.error('❌ Erro ao carregar artista ativo:', error);
    return null;
  }
};

// Limpar artista ativo do AsyncStorage
export const clearActiveArtist = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(ACTIVE_ARTIST_KEY);
    console.log('🗑️ Artista ativo removido do AsyncStorage');
  } catch (error) {
    console.error('❌ Erro ao limpar artista ativo:', error);
  }
};
