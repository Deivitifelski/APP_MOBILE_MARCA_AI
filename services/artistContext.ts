// Solução simples sem AsyncStorage por enquanto
export interface ActiveArtist {
  id: string;
  name: string;
  role: string;
}

// Variável global para armazenar o artista ativo (temporário)
let currentActiveArtist: ActiveArtist | null = null;

// Salvar artista ativo
export const setActiveArtist = async (artist: ActiveArtist): Promise<void> => {
  currentActiveArtist = artist;
  console.log('Artista ativo definido:', artist);
};

// Obter artista ativo
export const getActiveArtist = async (): Promise<ActiveArtist | null> => {
  return currentActiveArtist;
};

// Limpar artista ativo
export const clearActiveArtist = async (): Promise<void> => {
  currentActiveArtist = null;
};
