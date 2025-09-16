import { useState, useEffect } from 'react';
import { getActiveArtist, setActiveArtist as saveActiveArtist, clearActiveArtist, ActiveArtist } from './artistContext';
import { getCurrentUser } from './supabase/authService';
import { getArtists } from './supabase/artistService';

export const useActiveArtist = () => {
  const [activeArtist, setActiveArtistState] = useState<ActiveArtist | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadActiveArtist = async () => {
    try {
      setIsLoading(true);
      console.log('useActiveArtist: Iniciando carregamento do artista ativo');
      
      // Sempre obter o usuário atual primeiro
      const { user, error: userError } = await getCurrentUser();
      
      if (userError || !user) {
        console.log('useActiveArtist: Usuário não encontrado, limpando artista ativo');
        setActiveArtistState(null);
        return;
      }
      
      console.log('useActiveArtist: Usuário atual:', user.id);
      
      // Buscar artistas do usuário atual
      const { artists, error: artistsError } = await getArtists(user.id);
      
      if (artistsError) {
        console.log('useActiveArtist: Erro ao buscar artistas:', artistsError);
        setActiveArtistState(null);
        return;
      }
      
      console.log('useActiveArtist: Artistas do usuário:', artists?.length || 0);
      
      // Se não há artistas, limpar artista ativo
      if (!artists || artists.length === 0) {
        console.log('useActiveArtist: Usuário não tem artistas, limpando artista ativo');
        await clearActiveArtist();
        setActiveArtistState(null);
        return;
      }
      
      // Verificar se o artista salvo ainda é válido para este usuário
      const savedActiveArtist = await getActiveArtist();
      let validActiveArtist = null;
      
      if (savedActiveArtist) {
        // Verificar se o artista salvo ainda pertence ao usuário atual
        const currentArtistData = artists.find(artist => artist.id === savedActiveArtist.id);
        
        if (currentArtistData) {
          console.log('useActiveArtist: Artista salvo ainda é válido, usando dados atualizados');
          validActiveArtist = {
            id: currentArtistData.id,
            name: currentArtistData.name,
            role: currentArtistData.role || 'owner',
            profile_url: currentArtistData.profile_url
          };
          
          // Atualizar os dados salvos com as informações mais recentes
          await saveActiveArtist(validActiveArtist);
        } else {
          console.log('useActiveArtist: Artista salvo não pertence ao usuário atual, limpando');
          await clearActiveArtist();
        }
      }
      
      // Se não há artista válido salvo, pegar o primeiro artista do usuário
      if (!validActiveArtist) {
        console.log('useActiveArtist: Definindo primeiro artista como ativo');
        const firstArtist = artists[0];
        validActiveArtist = {
          id: firstArtist.id,
          name: firstArtist.name,
          role: firstArtist.role || 'owner',
          profile_url: firstArtist.profile_url
        };
        
        // Salvar como ativo
        await saveActiveArtist(validActiveArtist);
      }
      
      console.log('useActiveArtist: Artista ativo final:', validActiveArtist);
      setActiveArtistState(validActiveArtist);
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
