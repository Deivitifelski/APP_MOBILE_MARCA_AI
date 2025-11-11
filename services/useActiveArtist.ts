import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ActiveArtist, clearActiveArtist, getActiveArtist, setActiveArtist as saveActiveArtist } from './artistContext';
import { getArtists } from './supabase/artistService';
import { getCurrentUser } from './supabase/authService';

export const useActiveArtist = () => {
  const [activeArtist, setActiveArtistState] = useState<ActiveArtist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<any>(null);

  const loadActiveArtist = async (forceReload: boolean = false) => {
    try {
      setIsLoading(true);
      
      // Sempre obter o usuário atual primeiro
      const { user, error: userError } = await getCurrentUser();
      
      if (userError || !user) {
        setActiveArtistState(null);
        return;
      }
      
      // Pegar o artista salvo no AsyncStorage primeiro
      const savedActiveArtist = await getActiveArtist();
      
      // Se não há artista salvo ou se forçar reload, buscar do banco
      if (!savedActiveArtist || forceReload) {
        // Buscar artistas do usuário atual
        const { artists, error: artistsError } = await getArtists(user.id);
        
        if (artistsError) {
          setActiveArtistState(null);
          return;
        }
        
        // Se não há artistas, limpar artista ativo
        if (!artists || artists.length === 0) {
          await clearActiveArtist();
          setActiveArtistState(null);
          return;
        }
        
        // Se há artista salvo, usar esse, senão deixar null
        if (savedActiveArtist) {
          const currentArtistData = artists.find(artist => artist.id === savedActiveArtist.id);
          
          if (currentArtistData) {
            const validActiveArtist = {
              id: currentArtistData.id,
              name: currentArtistData.name,
              role: currentArtistData.role || 'owner',
              profile_url: currentArtistData.profile_url
            };
            
            await saveActiveArtist(validActiveArtist);
            setActiveArtistState(validActiveArtist);
          } else {
            await clearActiveArtist();
            setActiveArtistState(null);
          }
        } else {
          setActiveArtistState(null);
        }
      } else {
        // ✅ Respeitar o artista salvo no AsyncStorage
        // Apenas atualizar o estado se for diferente
        if (!activeArtist || activeArtist.id !== savedActiveArtist.id) {
          setActiveArtistState(savedActiveArtist);
        } else {
          // Mesmo artista, apenas atualizar campos (nome, imagem) mantendo o ID
          setActiveArtistState({
            ...activeArtist,
            name: savedActiveArtist.name,
            profile_url: savedActiveArtist.profile_url,
            role: savedActiveArtist.role
          });
        }
      }
    } catch (error) {
      setActiveArtistState(null);
    } finally {
      setIsLoading(false);
    }
  };

  const setActiveArtist = async (artist: ActiveArtist) => {
    try {
      // Salvar no AsyncStorage primeiro
      await saveActiveArtist(artist);
      // Atualizar estado imediatamente
      setActiveArtistState(artist);
    } catch (error) {
      // Erro ao definir artista ativo
    }
  };

  const updateActiveArtistFields = async (fields: Partial<ActiveArtist>) => {
    const currentArtist = await getActiveArtist();
    if (!currentArtist) return;

    const updatedArtist = { ...currentArtist, ...fields };
    await saveActiveArtist(updatedArtist);
    setActiveArtistState(updatedArtist);
  };

  useEffect(() => {
    loadActiveArtist();
  }, []);

  // 🔥 ESCUTAR MUDANÇAS NO ROLE DO ARTISTA EM TEMPO REAL
  useEffect(() => {
    // Limpar canal anterior
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (!activeArtist) {
      return;
    }

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return;
      }

      const channelName = `active-artist-${user.id}-${activeArtist.id}`;

      channelRef.current = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'artist_members',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              // Novo artista criado - apenas se não temos artista ativo
              if (!activeArtist) {
                loadActiveArtist(true);
              }
            } else if (payload.eventType === 'UPDATE') {
              const newData = payload.new as any;
              
              // Se é uma atualização do role do artista atual
              if (newData.artist_id === activeArtist.id && newData.role !== activeArtist.role) {
                // Apenas atualizar role, manter nome e imagem
                updateActiveArtistFields({ role: newData.role });
              }
            } else if (payload.eventType === 'DELETE') {
              const oldData = payload.old as any;
              
              // Se o usuário foi removido do artista atual
              if (oldData.artist_id === activeArtist.id) {
                clearActiveArtist();
                setActiveArtistState(null);
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'artists',
            filter: `id=eq.${activeArtist.id}`,
          },
          (payload) => {
            // Quando o artista atual é atualizado, atualizar apenas os campos mudados
            const updatedArtist = payload.new as any;
            updateActiveArtistFields({
              name: updatedArtist.name,
              profile_url: updatedArtist.profile_url
            });
          }
        )
        .subscribe();
    })();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [activeArtist?.id]);

  return {
    activeArtist,
    setActiveArtist,
    loadActiveArtist,
    updateActiveArtistFields,
    isLoading
  };
};
