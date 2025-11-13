import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ActiveArtist {
  id: string;
  name: string;
  role: string;
  profile_url?: string;
  musical_style?: string;
  created_at?: string;
}

const ACTIVE_ARTIST_KEY = '@marca_ai:active_artist';

// Salvar artista ativo no AsyncStorage
export const setActiveArtist = async (artist: ActiveArtist): Promise<void> => {
  try {
    await AsyncStorage.setItem(ACTIVE_ARTIST_KEY, JSON.stringify(artist));
  } catch (error) {
    // Erro ao salvar artista ativo
  }
};

// Obter artista ativo do AsyncStorage
export const getActiveArtist = async (): Promise<ActiveArtist | null> => {
  try {
    const stored = await AsyncStorage.getItem(ACTIVE_ARTIST_KEY);
    if (stored) {
      const artist = JSON.parse(stored);
      return artist;
    }
    return null;
  } catch (error) {
    return null;
  }
};

// Limpar artista ativo do AsyncStorage
export const clearActiveArtist = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(ACTIVE_ARTIST_KEY);
  } catch (error) {
    // Erro ao limpar artista ativo
  }
};
