import { useState, useEffect } from 'react';
import { getActiveArtist, setActiveArtist as saveActiveArtist, ActiveArtist } from './artistContext';
import { getCurrentUser } from './supabase/authService';
import { getArtists } from './supabase/artistService';

export const useActiveArtist = () => {
  const [activeArtist, setActiveArtistState] = useState<ActiveArtist | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadActiveArtist = async () => {
    try {
      setIsLoading(true);
      console.log('useActiveArtist: Iniciando carregamento do artista ativo');
      
      // Primeiro, tentar obter o artista ativo salvo
      let savedActiveArtist = await getActiveArtist();
      console.log('useActiveArtist: Artista salvo encontrado:', savedActiveArtist);
      
      // Se não há artista ativo salvo, pegar o primeiro artista do usuário
      if (!savedActiveArtist) {
        console.log('useActiveArtist: Nenhum artista salvo, buscando artistas do usuário');
        const { user, error: userError } = await getCurrentUser();
        
        if (!userError && user) {
          console.log('useActiveArtist: Usuário encontrado:', user.id);
          const { artists, error: artistsError } = await getArtists(user.id);
          
          console.log('useActiveArtist: Artistas encontrados:', artists?.length || 0);
          
          if (!artistsError && artists && artists.length > 0) {
            const firstArtist = artists[0];
            savedActiveArtist = {
              id: firstArtist.id,
              name: firstArtist.name,
              role: firstArtist.role || 'owner'
            };
            
            console.log('useActiveArtist: Definindo primeiro artista como ativo:', savedActiveArtist);
            
            // Salvar como ativo
            await saveActiveArtist(savedActiveArtist);
          }
        } else {
          console.log('useActiveArtist: Erro ao obter usuário:', userError);
        }
      }
      
      console.log('useActiveArtist: Artista ativo final:', savedActiveArtist);
      setActiveArtistState(savedActiveArtist);
    } catch (error) {
      console.error('Erro ao carregar artista ativo:', error);
      setActiveArtistState(null);
    } finally {
      setIsLoading(false);
    }
  };

  const setActiveArtist = async (artist: ActiveArtist) => {
    try {
      await saveActiveArtist(artist);
      setActiveArtistState(artist);
    } catch (error) {
      console.error('Erro ao definir artista ativo:', error);
    }
  };

  useEffect(() => {
    loadActiveArtist();
  }, []);

  return {
    activeArtist,
    setActiveArtist,
    loadActiveArtist,
    isLoading
  };
};
